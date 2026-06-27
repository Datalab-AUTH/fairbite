import os
import re
from abc import ABC, abstractmethod


def _temperature() -> float:
    return float(os.environ.get("LLM_TEMPERATURE", 0))


def _strip_thinking(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


class LLMProvider(ABC):
    def generate_content(self, prompt: str, system_msg: str) -> str:
        return _strip_thinking(self._generate(prompt, system_msg))

    @abstractmethod
    def _generate(self, prompt: str, system_msg: str) -> str:
        ...


class GeminiProvider(LLMProvider):
    def __init__(self):
        try:
            from google import genai
            from google.genai import types as genai_types
        except ImportError:
            raise ImportError("Install with: pip install google-genai")

        self._client = genai.Client(api_key=os.environ["LLM_API_KEY"])
        self._model = os.environ["LLM_MODEL"]
        self._types = genai_types
        # top_p is Gemini-only: mixing top_p with temperature is discouraged by OpenAI/Anthropic
        self._top_p = float(os.environ.get("LLM_TOP_P", 1))

    def _generate(self, prompt: str, system_msg: str) -> str:
        response = self._client.models.generate_content(
            model=self._model,
            contents=prompt,
            config=self._types.GenerateContentConfig(
                temperature=_temperature(),
                top_p=self._top_p,
                response_mime_type="application/json",
                system_instruction=system_msg,
            ),
        )
        return response.text


class OpenAIProvider(LLMProvider):
    def __init__(self):
        try:
            import openai
        except ImportError:
            raise ImportError("Install with: pip install openai")

        self._client = openai.OpenAI(api_key=os.environ["LLM_API_KEY"])
        self._model = os.environ["LLM_MODEL"]

    def _generate(self, prompt: str, system_msg: str) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            temperature=_temperature(),
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content


class AnthropicProvider(LLMProvider):
    def __init__(self):
        try:
            import anthropic
        except ImportError:
            raise ImportError("Install with: pip install anthropic")

        self._client = anthropic.Anthropic(api_key=os.environ["LLM_API_KEY"])
        self._model = os.environ["LLM_MODEL"]

    def _generate(self, prompt: str, system_msg: str) -> str:
        response = self._client.messages.create(
            model=self._model,
            max_tokens=8096,
            temperature=_temperature(),
            system=system_msg,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text


class OllamaProvider(LLMProvider):
    def __init__(self):
        try:
            import ollama
        except ImportError:
            raise ImportError("Install with: pip install ollama")

        base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
        self._client = ollama.Client(host=base_url)
        self._model = os.environ["LLM_MODEL"]

    def _generate(self, prompt: str, system_msg: str) -> str:
        response = self._client.chat(
            model=self._model,
            options={"temperature": _temperature()},
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt},
            ],
        )
        return response.message.content


PROVIDERS = {
    "gemini": GeminiProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "ollama": OllamaProvider,
}


def get_provider() -> LLMProvider:
    name = os.environ.get("LLM_PROVIDER", "").lower()
    if not name:
        raise ValueError("LLM_PROVIDER environment variable is not set.")
    if name not in PROVIDERS:
        raise ValueError(
            f"Unknown LLM provider: '{name}'. Available: {list(PROVIDERS.keys())}"
        )
    return PROVIDERS[name]()
