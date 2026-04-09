import json
import os

import anthropic


def _positive_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None or raw_value == "":
        return default

    try:
        parsed = int(raw_value)
    except ValueError as exc:
        raise RuntimeError(f"{name} deve ser um inteiro positivo.") from exc

    if parsed <= 0:
        raise RuntimeError(f"{name} deve ser maior que zero.")

    return parsed


def validate_security_config() -> None:
    _positive_int_env("MAX_IA_INPUT_CHARS", 20000)
    _positive_int_env("MAX_IA_FIELDS", 80)


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
    allow_ai_extraction = os.getenv("ALLOW_AI_EXTRACTION", "true").strip().lower()
    if allow_ai_extraction not in {"1", "true", "yes", "on"}:
        raise RuntimeError("Extracao com IA desabilitada por configuracao.")

    api_key = os.getenv("CLAUDE_API_KEY")
    if not api_key:
        raise RuntimeError("CLAUDE_API_KEY nao configurada.")

    model = os.getenv("CLAUDE_MODEL", "claude-opus-4-5")
    max_input_chars = _positive_int_env("MAX_IA_INPUT_CHARS", 20000)
    max_fields = _positive_int_env("MAX_IA_FIELDS", 80)

    sanitized_fields = [field.strip() for field in campos if field.strip()]
    sanitized_fields = sanitized_fields[:max_fields]

    client = anthropic.Anthropic(api_key=api_key)
    campos_str = ", ".join(sanitized_fields)
    texto_normalizado = texto_laudo[:max_input_chars]

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
                            f"Texto:\n{texto_normalizado}"
                        ),
                    }
                ],
            )
            return _extract_json_payload(response.content[0].text)
        except Exception as exc:
            last_error = exc

    raise RuntimeError(f"Falha ao extrair com IA: {last_error}")
