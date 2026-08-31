import json
import os
import urllib.request
from types import SimpleNamespace
from typing import List, Optional


_ORQUESTRADOR = None


class GeminiOrchestrator:
    """Integração Gemini com cliente reutilizado e modelo que já funcionou."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.model = model or os.getenv("GOOGLE_GEMINI_MODEL", "gemini-flash-lite-latest")
        self.candidate_models = self._montar_candidatos()
        self._modelo_ok = self.candidate_models[0] if self.candidate_models else self.model
        self._client = None

    def _montar_candidatos(self) -> List[str]:
        vistos = []
        for nome in (
            self.model,
            "gemini-flash-lite-latest",
            "gemini-2.5-flash-lite",
        ):
            if nome and nome not in vistos:
                vistos.append(nome)
        return vistos

    def _modelos_em_ordem(self) -> List[str]:
        if self._modelo_ok in self.candidate_models:
            return [self._modelo_ok] + [m for m in self.candidate_models if m != self._modelo_ok]
        return list(self.candidate_models)

    def _obter_client(self):
        if self._client is not None:
            return self._client
        from google import genai
        try:
            self._client = genai.Client(
                api_key=self.api_key,
                http_options={"timeout": 20000},
            )
        except TypeError:
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def _config_geracao(self):
        try:
            from google.genai import types
            kwargs = {
                "temperature": 0.2,
                "max_output_tokens": 1536,
            }
            try:
                kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
            except Exception:
                pass
            return types.GenerateContentConfig(**kwargs)
        except Exception:
            return None

    def run(self, prompt: str) -> SimpleNamespace:
        return SimpleNamespace(content=self._gerar_resposta(prompt))

    def _gerar_resposta(self, prompt: str) -> str:
        if not self.api_key:
            return (
                "Desculpe — a integração com a API Gemini não está configurada. "
                "Defina a variável de ambiente `GOOGLE_API_KEY`."
            )

        texto = self._via_sdk(prompt)
        if texto:
            return texto

        texto = self._via_rest(prompt)
        if texto:
            return texto

        return (
            "Desculpe — não consegui contatar a API Gemini no momento. "
            "Por favor, verifique a conectividade de rede."
        )

    def _via_sdk(self, prompt: str) -> Optional[str]:
        try:
            client = self._obter_client()
            config = self._config_geracao()
        except Exception as e:
            print(f"[Gemini SDK Import/Client Falha]: {e}")
            return None

        for m in self._modelos_em_ordem():
            try:
                kwargs = {"model": m, "contents": prompt}
                if config is not None:
                    kwargs["config"] = config
                response = client.models.generate_content(**kwargs)
                if response and getattr(response, "text", None):
                    self._modelo_ok = m
                    return response.text.strip()
            except Exception as sdk_err:
                print(f"[Gemini SDK ({m}) Falha]: {sdk_err}")
                continue
        return None

    def _via_rest(self, prompt: str) -> Optional[str]:
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1536,
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
        data = json.dumps(payload).encode("utf-8")

        for m in self._modelos_em_ordem():
            endpoint = (
                f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"
                f"?key={self.api_key}"
            )
            req = urllib.request.Request(
                endpoint,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=18) as response:
                    body = json.loads(response.read().decode("utf-8"))
                    candidatos = body.get("candidates") or []
                    if not candidatos:
                        continue
                    content = candidatos[0].get("content") or {}
                    parts = content.get("parts") if isinstance(content, dict) else []
                    textos = [
                        str(part.get("text", "")).strip()
                        for part in (parts or [])
                        if isinstance(part, dict) and part.get("text")
                    ]
                    if textos:
                        self._modelo_ok = m
                        return "\n".join(textos).strip()
            except Exception as err:
                print(f"[Gemini REST ({m}) Erro]: {err}")
                if "thinking" in str(err).lower() or "thinkingConfig" in str(err):
                    payload["generationConfig"].pop("thinkingConfig", None)
                    data = json.dumps(payload).encode("utf-8")
                continue
        return None


def obter_time_agentes() -> GeminiOrchestrator:
    """Retorna o orquestrador IA reutilizado entre requisições."""
    global _ORQUESTRADOR
    if _ORQUESTRADOR is None:
        _ORQUESTRADOR = GeminiOrchestrator()
    return _ORQUESTRADOR
