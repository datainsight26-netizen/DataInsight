import os
import json
import time
import urllib.error
import urllib.request
from types import SimpleNamespace
from typing import Any, Optional


class GeminiOrchestrator:
    """Wrapper para integração com a API Google Gemini via REST."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.model = model or os.getenv("GOOGLE_GEMINI_MODEL", "gemini-2.5-flash")

    def run(self, prompt: str) -> SimpleNamespace:
        return SimpleNamespace(content=self._gerar_resposta(prompt))

    def _gerar_resposta(self, prompt: str) -> str:
        if not self.api_key:
            return (
                "Desculpe — a integração com a API Gemini não está configurada. "
                "Defina a variável de ambiente `GOOGLE_API_KEY`."
            )

        endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
            f"?key={self.api_key}"
        )

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1024,
            },
        }

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        max_retries = 3
        backoff = 1
        last_error = None

        for attempt in range(1, max_retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=60) as response:
                    body = json.loads(response.read().decode("utf-8"))
                    candidates = body.get("candidates", [])
                    if not candidates:
                        return "Não foi possível extrair a resposta do modelo."

                    candidate = candidates[0]
                    if not isinstance(candidate, dict):
                        return "Não foi possível extrair a resposta do modelo."

                    content = candidate.get("content", {})
                    if isinstance(content, dict):
                        parts = content.get("parts", [])
                        textos = [
                            str(part.get("text", "")).strip()
                            for part in parts
                            if isinstance(part, dict) and part.get("text")
                        ]
                        if textos:
                            return "\n".join(textos).strip()

                    if "output" in candidate:
                        return str(candidate.get("output", "")).strip()

                    return "Não foi possível extrair a resposta do modelo."

            except urllib.error.HTTPError as err:
                status = err.code
                detalhe = err.read().decode('utf-8', errors='ignore')[:300]
                print(f"[Erro Gemini API HTTP {status}]: {detalhe}")
                last_error = err
                if 500 <= status < 600 and attempt < max_retries:
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                break
            except urllib.error.URLError as err:
                print(f"[Erro Gemini API URLError]: {err}")
                last_error = err
                if attempt < max_retries:
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                break
            except Exception as err:
                detalhe = str(err)
                print(f"[Erro Gemini API Exception]: {detalhe}")
                last_error = err
                if attempt < max_retries:
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                break

        if last_error is not None:
            detalhe = str(last_error)
            if hasattr(last_error, "read"):
                try:
                    detalhe = f"{last_error}: {last_error.read().decode('utf-8')[:300]}"
                except Exception:
                    pass
            print(f"[Erro Gemini API final]: {detalhe}")

        return (
            "Desculpe — não consegui contatar a API Gemini no momento. "
            "Por favor, verifique a chave de API e a conectividade de rede."
        )


def obter_time_agentes() -> GeminiOrchestrator:
    return GeminiOrchestrator()
