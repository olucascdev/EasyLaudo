import json
import os

import anthropic


def _extract_json_payload(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json\n", "", 1).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(cleaned[start : end + 1])


def extrair_com_ia(texto_laudo: str, campos: list[str]) -> dict:
    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        raise RuntimeError("CLAUDE_API_KEY nao configurada.")

    model = os.getenv("CLAUDE_MODEL", "claude-opus-4-5")
    client = anthropic.Anthropic(api_key=api_key)
    campos_str = ", ".join(campos)

    last_error: Exception | None = None
    for _ in range(3):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            "Extraia do texto abaixo os seguintes campos: "
                            f"{campos_str}. "
                            "Retorne APENAS um objeto JSON sem markdown. "
                            "Se um campo nao for encontrado, use null.\n\n"
                            f"Texto:\n{texto_laudo}"
                        ),
                    }
                ],
            )
            return _extract_json_payload(response.content[0].text)
        except Exception as exc:
            last_error = exc

    raise RuntimeError(f"Falha ao extrair com IA: {last_error}")

