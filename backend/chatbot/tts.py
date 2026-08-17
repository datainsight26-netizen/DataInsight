import re
import base64
import io
import importlib
from typing import Optional, Tuple, Any

_KOKORO_PIPELINES = {}


def _limpar_texto_para_voz(texto: str) -> str:
    if not texto:
        return ''
    texto_limpo = re.sub(r'\*+', '', texto)
    texto_limpo = re.sub(r'`+', '', texto_limpo)
    texto_limpo = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', texto_limpo)
    texto_limpo = re.sub(r' {2,}', ' ', texto_limpo)
    return texto_limpo.strip()


def sintetizar_resposta_voz(texto: str) -> Optional[Tuple[str, str]]:
    texto = _limpar_texto_para_voz(texto)
    if not texto:
        return None

    try:
        if importlib.util.find_spec("kokoro") is not None:
            from kokoro import KPipeline

            resultado = None
            for lang_code in ["pt-BR", "pt_br", "pt", "a"]:
                try:
                    if lang_code not in _KOKORO_PIPELINES:
                        _KOKORO_PIPELINES[lang_code] = KPipeline(lang_code=lang_code)
                    pipeline = _KOKORO_PIPELINES[lang_code]
                    resultado = pipeline(texto)
                    break
                except Exception:
                    _KOKORO_PIPELINES.pop(lang_code, None)

            if resultado is not None:
                audio_bytes = None
                if isinstance(resultado, (bytes, bytearray)):
                    audio_bytes = bytes(resultado)
                elif hasattr(resultado, "audio") and isinstance(resultado.audio, (bytes, bytearray)):
                    audio_bytes = bytes(resultado.audio)
                elif isinstance(resultado, dict) and resultado.get("audio"):
                    raw = resultado["audio"]
                    if isinstance(raw, (bytes, bytearray)):
                        audio_bytes = bytes(raw)
                    elif isinstance(raw, str):
                        try:
                            audio_bytes = base64.b64decode(raw)
                        except Exception:
                            audio_bytes = raw.encode("utf-8")

                if audio_bytes:
                    return base64.b64encode(audio_bytes).decode("utf-8"), "audio/wav"
    except Exception as err:
        print(f"[Kokoro TTS fallback]: {err}")

    try:
        from gtts import gTTS

        buffer = io.BytesIO()
        gTTS(text=texto, lang="pt").write_to_fp(buffer)
        buffer.seek(0)
        return base64.b64encode(buffer.read()).decode("utf-8"), "audio/mpeg"
    except Exception as err:
        print(f"[gTTS erro]: {err}")
        return None


def sintetizar_texto_voz(texto: str) -> Optional[Tuple[str, str]]:
    return sintetizar_resposta_voz(texto)
