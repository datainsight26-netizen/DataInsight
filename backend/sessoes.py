# ==============================================================================
# sessoes.py
# ==============================================================================
# Este código pertence à plataforma @EnterSight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
#
# Gerenciador central de sessões simultâneas por usuário.
# A fonte de verdade é o MongoDB (coleção "sessoes"). Não há cache em memória:
# assim, múltiplos workers do Gunicorn enxergam sempre o mesmo estado.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import hashlib
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

from bson import ObjectId
from flask import g, request, session
from pymongo.errors import DuplicateKeyError

from .db import sessoes


# ==============================================================================
# 2. CONFIGURAÇÃO
# ==============================================================================

def _env_int(nome, padrao, minimo=1):
    """Lê uma variável de ambiente inteira com fallback seguro."""
    try:
        valor = int(str(os.getenv(nome, padrao)).strip())
        return valor if valor >= minimo else padrao
    except (TypeError, ValueError):
        return padrao


def _env_bool(nome, padrao=True):
    """Lê uma variável de ambiente booleana com fallback seguro."""
    valor = str(os.getenv(nome, "true" if padrao else "false")).strip().lower()
    return valor in ("1", "true", "sim", "yes", "on")


# Limite padrão: 3 sessões simultâneas por usuário.
MAX_SESSOES_SIMULTANEAS = _env_int("MAX_SESSOES_SIMULTANEAS", 3);

# Tempo de vida absoluto da sessão no servidor.
# "Lembrar de mim" usa SESSOES_TTL_DIAS; sem lembrar, usa SESSOES_TTL_HORAS.
SESSOES_TTL_DIAS = _env_int("SESSOES_TTL_DIAS", 30)
SESSOES_TTL_HORAS = _env_int("SESSOES_TTL_HORAS", 24)

# Intervalo mínimo (em segundos) entre atualizações de "último acesso" no banco.
SESSOES_INTERVALO_ATUALIZACAO = _env_int("SESSOES_INTERVALO_ATUALIZACAO", 60, 1)

# Privacidade do IP. Por padrão o IP é anonimizado (LGPD): 192.168.1.77 -> 192.168.1.0
SESSOES_REGISTRAR_IP = _env_bool("SESSOES_REGISTRAR_IP", True)
SESSOES_ANONIMIZAR_IP = _env_bool("SESSOES_ANONIMIZAR_IP", True)
SESSOES_CONFIAR_PROXY = _env_bool("SESSOES_CONFIAR_PROXY", True)

MENSAGEM_LIMITE = (
    f"Você atingiu o limite de {MAX_SESSOES_SIMULTANEAS} sessões simultâneas. "
    "Para acessar por este dispositivo, encerre uma das suas sessões ativas."
)
MENSAGEM_SESSAO_INVALIDA = "Sua sessão não é mais válida. Faça login novamente."
MENSAGEM_ERRO_INTERNO = "Não foi possível validar sua sessão agora. Tente novamente em instantes."

_MENSAGENS_MOTIVO = {
    "limite": MENSAGEM_LIMITE,
    "sessao_encerrada": "Sua sessão foi encerrada. Faça login novamente.",
    "sessao_revogada": "Sua sessão foi encerrada em outro dispositivo. Faça login novamente.",
    "revogada": "Sua sessão foi encerrada. Faça login novamente.",
    "expirada": "Sua sessão expirou. Faça login novamente.",
    "nao_encontrada": "Sua sessão não foi encontrada. Faça login novamente.",
    "sem_sessao": "Faça login para continuar.",
    "senha_alterada": "Sua senha foi alterada. Faça login novamente.",
    "logout": "Você saiu da sua conta.",
    "erro": MENSAGEM_ERRO_INTERNO,
}


def mensagem_para_motivo(motivo):
    """Retorna a mensagem amigável correspondente a um motivo de invalidação."""
    return _MENSAGENS_MOTIVO.get(str(motivo or ""), MENSAGEM_SESSAO_INVALIDA)


# ==============================================================================
# 3. UTILITÁRIOS INTERNOS
# ==============================================================================

def _agora():
    """Retorna o instante atual em UTC sem timezone (formato gravado no Mongo)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalizar_usuario_id(usuario_id):
    """
    Normaliza o identificador do usuário.

    O restante da aplicação grava o `usuario_id` como ObjectId na coleção
    `usuarios`. Mantemos ObjectId quando possível e string como fallback para
    bases legadas.
    """
    if isinstance(usuario_id, ObjectId):
        return usuario_id
    valor = str(usuario_id or "").strip()
    if not valor:
        return None
    if ObjectId.is_valid(valor):
        return ObjectId(valor)
    return valor


def _id_objeto(valor):
    """Converte um identificador público de sessão para ObjectId, se possível."""
    try:
        return ObjectId(str(valor))
    except Exception:
        return None


def _hash_token(token):
    """
    Armazena apenas o hash SHA-256 do token de sessão.

    O token em claro fica somente no cookie de sessão assinado do Flask. Se o
    banco for vazado, os tokens não podem ser reutilizados diretamente.
    """
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def _iso(dt):
    """Serializa um datetime UTC sem timezone no formato ISO-8601 com sufixo Z."""
    if not isinstance(dt, datetime):
        return None
    return dt.replace(microsecond=0).isoformat() + "Z"


def obter_device_id():
    """
    Retorna o identificador persistente do dispositivo (cookie HttpOnly).

    O cookie é diferente por navegador/perfil e não depende do IP, permitindo
    diferenciar dispositivos que compartilham a mesma rede.
    """
    device_id = request.cookies.get("ds_device_id")
    if device_id:
        return device_id

    novo = getattr(g, "_novo_device_id", None)
    if not novo:
        novo = secrets.token_urlsafe(18)
        g._novo_device_id = novo
    return novo


def _anonimizar_ip(ip):
    """Mascara a parte final do IP para reduzir dados pessoais armazenados."""
    if not ip:
        return None
    if ":" in ip:
        grupos = [g for g in ip.split(":") if g]
        return ":".join(grupos[:4]) + "::" if grupos else None
    partes = ip.split(".")
    if len(partes) == 4:
        return ".".join(partes[:3] + ["0"])
    return ip


def _obter_ip():
    """Obtém o IP do cliente respeitando proxy e configuração de privacidade."""
    if not SESSOES_REGISTRAR_IP:
        return None

    ip = request.remote_addr or ""
    if SESSOES_CONFIAR_PROXY:
        encaminhado = request.headers.get("X-Forwarded-For", "")
        if encaminhado:
            ip = encaminhado.split(",")[0].strip() or ip

    if not ip:
        return None

    if SESSOES_ANONIMIZAR_IP:
        ip = _anonimizar_ip(ip)
    return ip


def _detectar_navegador(user_agent):
    ua = (user_agent or "").lower()
    if "edg/" in ua:
        return "Microsoft Edge"
    if "opr/" in ua or "opera" in ua:
        return "Opera"
    if "samsungbrowser" in ua:
        return "Samsung Internet"
    if "firefox/" in ua:
        return "Firefox"
    if "chrome/" in ua or "crios" in ua:
        return "Chrome"
    if "safari/" in ua:
        return "Safari"
    return "Navegador desconhecido"


def _detectar_sistema_operacional(user_agent):
    ua = (user_agent or "").lower()
    if "windows" in ua:
        return "Windows"
    if "android" in ua:
        return "Android"
    if "iphone" in ua or "ipad" in ua or "ipod" in ua:
        return "iOS"
    if "mac os x" in ua or "macintosh" in ua:
        return "macOS"
    if "linux" in ua:
        return "Linux"
    return "Sistema desconhecido"


def _detectar_tipo_dispositivo(user_agent):
    ua = (user_agent or "").lower()
    if "ipad" in ua or "tablet" in ua:
        return "Tablet"
    if "android" in ua and "mobile" not in ua:
        return "Tablet"
    if "mobile" in ua or "iphone" in ua or "ipod" in ua or "android" in ua:
        return "Celular"
    return "Computador"


def _contexto_dispositivo():
    """Monta o retrato do dispositivo/navegador para o registro da sessão."""
    user_agent = (request.headers.get("User-Agent") or "")[:512]
    navegador = _detectar_navegador(user_agent)
    sistema = _detectar_sistema_operacional(user_agent)
    tipo = _detectar_tipo_dispositivo(user_agent)
    return {
        "device_id": obter_device_id(),
        "user_agent": user_agent,
        "navegador": navegador,
        "sistema_operacional": sistema,
        "tipo_dispositivo": tipo,
        "dispositivo": f"{navegador} · {sistema} ({tipo})",
        "ip": _obter_ip(),
    }


def _calcular_expiracao(lembrar):
    agora = _agora()
    if lembrar:
        return agora + timedelta(days=SESSOES_TTL_DIAS)
    return agora + timedelta(hours=SESSOES_TTL_HORAS)


def _revogar_documento(documento, motivo, agora=None):
    """Revoga um documento de sessão e libera o slot ocupado."""
    agora = agora or _agora()
    try:
        sessoes.update_one(
            {"_id": documento["_id"], "status": "ativa"},
            {
                "$set": {
                    "status": "revogada",
                    "encerrada_em": agora,
                    "atualizado_em": agora,
                    "motivo_encerramento": motivo,
                },
                "$unset": {"slot": ""},
            },
        )
    except Exception as exc:
        print(f"[sessoes] Falha ao revogar sessão {documento.get('_id')}: {exc}")


def _expirar_sessoes_vencidas(usuario_id, agora=None):
    """Marca como revogadas (motivo expiracao) as sessões já vencidas."""
    agora = agora or _agora()
    filtro = {"status": "ativa", "expira_em": {"$lte": agora}}
    if usuario_id is not None:
        filtro["usuario_id"] = usuario_id
    try:
        sessoes.update_many(
            filtro,
            {
                "$set": {
                    "status": "revogada",
                    "encerrada_em": agora,
                    "atualizado_em": agora,
                    "motivo_encerramento": "expiracao",
                },
                "$unset": {"slot": ""},
            },
        )
    except Exception as exc:
        print(f"[sessoes] Falha ao expirar sessões vencidas: {exc}")


def _liberar_slots_excedentes(usuario_id, agora=None):
    """
    Revoga sessões que ocupam slots acima do limite atual.

    Cenário: o administrador reduz MAX_SESSOES_SIMULTANEAS de 3 para 2. As
    sessões no slot 2 deixam de ser aceitas na próxima validação/criação.
    """
    agora = agora or _agora()
    try:
        sessoes.update_many(
            {
                "usuario_id": usuario_id,
                "status": "ativa",
                "slot": {"$gte": MAX_SESSOES_SIMULTANEAS},
            },
            {
                "$set": {
                    "status": "revogada",
                    "encerrada_em": agora,
                    "atualizado_em": agora,
                    "motivo_encerramento": "limite_reduzido",
                },
                "$unset": {"slot": ""},
            },
        )
    except Exception as exc:
        print(f"[sessoes] Falha ao liberar slots excedentes: {exc}")


def _liberar_slots_orfaos(usuario_id, agora=None):
    """
    Libera slots presos por documentos que já não são sessões ativas válidas.

    Isso protege contra inconsistências (ex.: processo interrompido entre a
    criação do documento e a revogação).
    """
    agora = agora or _agora()
    try:
        sessoes.update_many(
            {
                "usuario_id": usuario_id,
                "slot": {"$exists": True},
                "$or": [
                    {"status": {"$ne": "ativa"}},
                    {"expira_em": {"$lte": agora}},
                ],
            },
            {
                "$set": {
                    "status": "revogada",
                    "encerrada_em": agora,
                    "atualizado_em": agora,
                    "motivo_encerramento": "slot_liberado",
                },
                "$unset": {"slot": ""},
            },
        )
    except Exception as exc:
        print(f"[sessoes] Falha ao liberar slots órfãos: {exc}")


def _atualizar_ultimo_acesso(documento, agora):
    """
    Atualiza o último acesso no Mongo, no máximo a cada N segundos.

    A throttling evita uma escrita por requisição sem perder a informação
    necessária para a tela de dispositivos conectados.
    """
    ultimo_touch = session.get("sessao_touch_ts")
    try:
        if ultimo_touch and (time.time() - float(ultimo_touch)) < SESSOES_INTERVALO_ATUALIZACAO:
            return
    except (TypeError, ValueError):
        pass

    try:
        sessoes.update_one(
            {"_id": documento["_id"], "status": "ativa"},
            {
                "$set": {
                    "ultimo_acesso_em": agora,
                    "ultimo_ip": _obter_ip(),
                    "atualizado_em": agora,
                }
            },
        )
        documento["ultimo_acesso_em"] = agora
        session["sessao_touch_ts"] = time.time()
    except Exception as exc:
        print(f"[sessoes] Falha ao atualizar último acesso: {exc}")


def _serializar(documento, token_atual=None):
    """Converte um documento de sessão no payload público usado pelo frontend."""
    token_hash_atual = _hash_token(token_atual) if token_atual else None
    return {
        "id": str(documento.get("_id")),
        "atual": bool(token_hash_atual and documento.get("token_hash") == token_hash_atual),
        "dispositivo": documento.get("dispositivo") or "Dispositivo desconhecido",
        "navegador": documento.get("navegador") or "Navegador desconhecido",
        "sistema_operacional": documento.get("sistema_operacional") or "Sistema desconhecido",
        "tipo_dispositivo": documento.get("tipo_dispositivo") or "Computador",
        "ip": documento.get("ip") or documento.get("ultimo_ip"),
        "criado_em": _iso(documento.get("criado_em")),
        "ultimo_acesso_em": _iso(documento.get("ultimo_acesso_em")),
        "expira_em": _iso(documento.get("expira_em")),
        "lembrar": bool(documento.get("lembrar")),
    }


# ==============================================================================
# 4. CRIAÇÃO E VALIDAÇÃO DE SESSÕES
# ==============================================================================

def criar_sessao(usuario_id, lembrar=False):
    """
    Cria uma sessão lógica respeitando o limite de sessões simultâneas.

    Estratégia de concorrência sem transações:
      - Cada sessão ativa ocupa um "slot" inteiro (0..limite-1).
      - Existe índice único parcial em (usuario_id, slot) para documentos com
        slot existente.
      - Duas requisições concorrentes não conseguem inserir no mesmo slot; a
        que perder tenta o próximo. Se todos estiverem ocupados, o login é
        bloqueado. Isso funciona inclusive em MongoDB standalone e com vários
        workers do Gunicorn.

    Retorno:
      {"ok": True, "token": "...", "sessao": {...}}
      {"ok": False, "motivo": "limite"|"erro"|"usuario_invalido", "mensagem": "..."}
    """
    uid = _normalizar_usuario_id(usuario_id)
    if not uid:
        return {
            "ok": False,
            "motivo": "usuario_invalido",
            "mensagem": MENSAGEM_ERRO_INTERNO,
        }

    agora = _agora()
    expira_em = _calcular_expiracao(lembrar)
    token = secrets.token_urlsafe(48)
    token_hash = _hash_token(token)
    contexto = _contexto_dispositivo()

    base = {
        "usuario_id": uid,
        "token_hash": token_hash,
        "status": "ativa",
        "criado_em": agora,
        "atualizado_em": agora,
        "ultimo_acesso_em": agora,
        "expira_em": expira_em,
        "encerrada_em": None,
        "motivo_encerramento": None,
        "lembrar": bool(lembrar),
        **contexto,
    }

    try:
        # Limpeza inicial: sessões vencidas, slots acima do limite atual e
        # documentos inconsistentes não podem bloquear vagas válidas.
        _expirar_sessoes_vencidas(uid, agora)
        _liberar_slots_excedentes(uid, agora)
        _liberar_slots_orfaos(uid, agora)

        # Duas rodadas: a segunda tenta novamente após limpar sessões vencidas
        # que possam ter ocupado um slot entre as verificações.
        for tentativa in range(2):
            if tentativa == 1:
                _expirar_sessoes_vencidas(uid)
                _liberar_slots_excedentes(uid)
                _liberar_slots_orfaos(uid)

            for slot in range(MAX_SESSOES_SIMULTANEAS):
                documento = dict(base)
                documento["slot"] = slot
                try:
                    resultado = sessoes.insert_one(documento)
                    documento["_id"] = resultado.inserted_id
                    return {"ok": True, "token": token, "sessao": documento}
                except DuplicateKeyError as exc:
                    # Colisão de token é praticamente impossível (2^-256), mas
                    # não deve ser confundida com "limite atingido".
                    if "token_hash" in str(exc):
                        print(f"[sessoes] Colisão inesperada de token_hash: {exc}")
                        return {
                            "ok": False,
                            "motivo": "erro",
                            "mensagem": MENSAGEM_ERRO_INTERNO,
                        }
                    # Slot ocupado por outra sessão ativa (ou concorrente).
                    continue

        _expirar_sessoes_vencidas(uid)
        _liberar_slots_orfaos(uid)
        return {"ok": False, "motivo": "limite", "mensagem": MENSAGEM_LIMITE}

    except Exception as exc:
        print(f"[sessoes] Erro ao criar sessão: {exc}")
        return {"ok": False, "motivo": "erro", "mensagem": MENSAGEM_ERRO_INTERNO}


def validar_sessao_atual(forcar=False):
    """
    Valida a sessão lógica associada ao cookie Flask atual.

    Retorno:
      {"valida": True, "motivo": None, "sessao": {...}}
      {"valida": False, "motivo": "...", "sessao": {...}|None}

    O resultado é cacheado por requisição em `g` para evitar múltiplas
    consultas quando `login_required` e um hook global chamam a validação.
    """
    if not forcar:
        cache = getattr(g, "_sessao_validada_resultado", None)
        if cache is not None:
            return cache

    token = session.get("sessao_token")
    usuario_id = session.get("usuario_id")

    if not token or not usuario_id:
        resultado = {
            "valida": False,
            "motivo": "sem_sessao",
            "sessao": None,
        }
        g._sessao_validada_resultado = resultado
        return resultado

    try:
        documento = sessoes.find_one({"token_hash": _hash_token(token)})
    except Exception as exc:
        print(f"[sessoes] Erro ao consultar sessão: {exc}")
        resultado = {
            "valida": False,
            "motivo": "erro",
            "sessao": None,
            "mensagem": MENSAGEM_ERRO_INTERNO,
        }
        g._sessao_validada_resultado = resultado
        return resultado

    agora = _agora()

    if not documento:
        resultado = {"valida": False, "motivo": "nao_encontrada", "sessao": None}
        g._sessao_validada_resultado = resultado
        return resultado

    if str(documento.get("usuario_id")) != str(usuario_id):
        resultado = {"valida": False, "motivo": "revogada", "sessao": None}
        g._sessao_validada_resultado = resultado
        return resultado

    if documento.get("status") != "ativa":
        resultado = {"valida": False, "motivo": "revogada", "sessao": documento}
        g._sessao_validada_resultado = resultado
        return resultado

    expira_em = documento.get("expira_em")
    if expira_em and expira_em <= agora:
        _revogar_documento(documento, "expiracao", agora)
        resultado = {"valida": False, "motivo": "expirada", "sessao": documento}
        g._sessao_validada_resultado = resultado
        return resultado

    _atualizar_ultimo_acesso(documento, agora)
    resultado = {"valida": True, "motivo": None, "sessao": documento}
    g._sessao_validada_resultado = resultado
    return resultado


def iniciar_sessao_web(usuario, lembrar=False):
    """
    Cria (ou reutiliza) a sessão lógica e grava o token no cookie Flask.

    Deve ser chamado em todos os pontos que autenticam um usuário: login,
    cadastro e retorno de pagamento. Se o navegador já possui uma sessão válida
    do mesmo usuário, ela é reutilizada para não consumir uma vaga à toa.
    """
    if not isinstance(usuario, dict):
        return {"ok": False, "motivo": "usuario_invalido", "mensagem": MENSAGEM_ERRO_INTERNO}

    uid = usuario.get("_id") or usuario.get("id") or usuario.get("usuario_id")
    if not uid:
        return {"ok": False, "motivo": "usuario_invalido", "mensagem": MENSAGEM_ERRO_INTERNO}

    atual = validar_sessao_atual()

    # Mesmo usuário e sessão ainda válida: não cria outra vaga.
    if atual.get("valida") and str(atual["sessao"].get("usuario_id")) == str(uid):
        nova_expiracao = _calcular_expiracao(lembrar)
        try:
            sessoes.update_one(
                {"_id": atual["sessao"]["_id"], "status": "ativa"},
                {
                    "$set": {
                        "lembrar": bool(lembrar),
                        "expira_em": nova_expiracao,
                        "ultimo_acesso_em": _agora(),
                        "atualizado_em": _agora(),
                    }
                },
            )
            atual["sessao"]["expira_em"] = nova_expiracao
        except Exception as exc:
            print(f"[sessoes] Falha ao renovar sessão reutilizada: {exc}")

        session["sessao_id"] = str(atual["sessao"]["_id"])
        session["sessao_touch_ts"] = time.time()
        session.permanent = bool(lembrar)
        return {"ok": True, "reutilizada": True, "sessao": atual["sessao"]}

    # Havia uma sessão de outro usuário (troca de conta) ou uma sessão inválida.
    if session.get("sessao_token"):
        encerrar_sessao_atual("troca_de_usuario")

    session.clear()

    resultado = criar_sessao(uid, lembrar=lembrar)
    if not resultado.get("ok"):
        return resultado

    session["sessao_token"] = resultado["token"]
    session["sessao_id"] = str(resultado["sessao"]["_id"])
    session["sessao_touch_ts"] = time.time()
    session.permanent = bool(lembrar)

    g._sessao_validada_resultado = {
        "valida": True,
        "motivo": None,
        "sessao": resultado["sessao"],
    }
    return {
        "ok": True,
        "reutilizada": False,
        "token": resultado["token"],
        "sessao": resultado["sessao"],
    }


# ==============================================================================
# 5. ENCERRAMENTO / REVOGAÇÃO
# ==============================================================================

def encerrar_sessao_atual(motivo="logout"):
    """Revoga a sessão lógica atual e remove seus identificadores do cookie."""
    token = session.get("sessao_token")
    if token:
        agora = _agora()
        try:
            sessoes.update_one(
                {"token_hash": _hash_token(token), "status": "ativa"},
                {
                    "$set": {
                        "status": "revogada",
                        "encerrada_em": agora,
                        "atualizado_em": agora,
                        "motivo_encerramento": motivo,
                    },
                    "$unset": {"slot": ""},
                },
            )
        except Exception as exc:
            print(f"[sessoes] Falha ao encerrar sessão atual: {exc}")

    session.pop("sessao_token", None)
    session.pop("sessao_id", None)
    session.pop("sessao_touch_ts", None)


def revogar_sessao(usuario_id, sessao_id, motivo="manual"):
    """
    Revoga uma sessão específica, validando a propriedade.

    A consulta inclui `usuario_id`, então um usuário nunca consegue encerrar a
    sessão de outro, mesmo sabendo o ID.
    """
    uid = _normalizar_usuario_id(usuario_id)
    oid = _id_objeto(sessao_id)
    if not uid or not oid:
        return {"ok": False, "motivo": "id_invalido"}

    try:
        documento = sessoes.find_one({"_id": oid, "usuario_id": uid})
    except Exception as exc:
        print(f"[sessoes] Falha ao buscar sessão para revogar: {exc}")
        return {"ok": False, "motivo": "erro"}

    if not documento:
        return {"ok": False, "motivo": "nao_encontrada"}

    token_atual = session.get("sessao_token")
    era_atual = bool(token_atual and documento.get("token_hash") == _hash_token(token_atual))

    if documento.get("status") != "ativa":
        return {"ok": True, "ja_encerrada": True, "era_atual": era_atual}

    agora = _agora()
    try:
        sessoes.update_one(
            {"_id": oid, "usuario_id": uid, "status": "ativa"},
            {
                "$set": {
                    "status": "revogada",
                    "encerrada_em": agora,
                    "atualizado_em": agora,
                    "motivo_encerramento": motivo,
                },
                "$unset": {"slot": ""},
            },
        )
    except Exception as exc:
        print(f"[sessoes] Falha ao revogar sessão {sessao_id}: {exc}")
        return {"ok": False, "motivo": "erro"}

    return {"ok": True, "era_atual": era_atual}


def revogar_outras_sessoes(usuario_id, token_atual):
    """Revoga todas as sessões do usuário, exceto a sessão atual."""
    uid = _normalizar_usuario_id(usuario_id)
    if not uid or not token_atual:
        return 0

    agora = _agora()
    try:
        resultado = sessoes.update_many(
            {
                "usuario_id": uid,
                "status": "ativa",
                "token_hash": {"$ne": _hash_token(token_atual)},
            },
            {
                "$set": {
                    "status": "revogada",
                    "encerrada_em": agora,
                    "atualizado_em": agora,
                    "motivo_encerramento": "encerrada_pelo_usuario",
                },
                "$unset": {"slot": ""},
            },
        )
        return int(resultado.modified_count or 0)
    except Exception as exc:
        print(f"[sessoes] Falha ao revogar outras sessões: {exc}")
        return 0


def revogar_todas_sessoes(usuario_id, motivo="seguranca"):
    """Revoga todas as sessões do usuário (ex.: após troca de senha)."""
    uid = _normalizar_usuario_id(usuario_id)
    if not uid:
        return 0

    agora = _agora()
    try:
        resultado = sessoes.update_many(
            {"usuario_id": uid, "status": "ativa"},
            {
                "$set": {
                    "status": "revogada",
                    "encerrada_em": agora,
                    "atualizado_em": agora,
                    "motivo_encerramento": motivo,
                },
                "$unset": {"slot": ""},
            },
        )
        return int(resultado.modified_count or 0)
    except Exception as exc:
        print(f"[sessoes] Falha ao revogar todas as sessões: {exc}")
        return 0


# ==============================================================================
# 6. LISTAGEM
# ==============================================================================

def listar_sessoes_ativas(usuario_id, token_atual=None):
    """Retorna as sessões ativas e não vencidas do usuário, mais recentes antes."""
    uid = _normalizar_usuario_id(usuario_id)
    if not uid:
        return []

    agora = _agora()
    _expirar_sessoes_vencidas(uid, agora)
    _liberar_slots_excedentes(uid, agora)

    try:
        cursor = (
            sessoes.find(
                {
                    "usuario_id": uid,
                    "status": "ativa",
                    "expira_em": {"$gt": agora},
                }
            )
            .sort("ultimo_acesso_em", -1)
        )
        return [_serializar(documento, token_atual) for documento in cursor]
    except Exception as exc:
        print(f"[sessoes] Falha ao listar sessões: {exc}")
        return []


def contar_sessoes_ativas(usuario_id):
    """Conta as sessões ativas do usuário (usado em diagnósticos/testes)."""
    uid = _normalizar_usuario_id(usuario_id)
    if not uid:
        return 0
    try:
        return int(
            sessoes.count_documents(
                {"usuario_id": uid, "status": "ativa", "expira_em": {"$gt": _agora()}}
            )
        )
    except Exception:
        return 0
