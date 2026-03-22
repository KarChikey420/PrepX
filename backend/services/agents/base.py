"""
services.agents.base
~~~~~~~~~~~~~~~~~~~~
Base agent class wrapping the OpenAI-compatible async client for Kimi K2
(hosted on NVIDIA). Provides retry logic via tenacity and structured logging.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import openai
from openai import AsyncOpenAI
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
import structlog

from core.config import settings
from core.exceptions import ExternalAPIError, RateLimitError

logger = structlog.get_logger(__name__)


class BaseAgent:
    """
    Foundation for all AI agents. Wraps the async OpenAI client
    configured for the Kimi K2 model via NVIDIA's API.

    Subclasses override system prompts and implement domain logic.
    """

    def __init__(
        self,
        system_prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> None:
        self.system_prompt = system_prompt
        self.model = model or settings.kimi_model
        self.temperature = temperature
        self.max_tokens = max_tokens

        self._client = AsyncOpenAI(
            api_key=settings.kimi_api_key,
            base_url=settings.kimi_base_url,
        )

    @retry(
        retry=retry_if_exception_type((openai.APITimeoutError, openai.APIConnectionError)),
        wait=wait_exponential(multiplier=1, min=1, max=30),
        stop=stop_after_attempt(3),
        before_sleep=lambda retry_state: logger.warning(
            "agent.retry",
            attempt=retry_state.attempt_number,
            wait=retry_state.next_action.sleep,  # type: ignore[union-attr]
        ),
    )
    async def _call_llm(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[str | Dict[str, Any]] = None,
        stream: bool = False,
    ) -> Any:
        """
        Execute an LLM call with automatic retry on transient failures.

        Raises:
            RateLimitError: On HTTP 429 responses.
            ExternalAPIError: On other non-retryable API errors.
        """
        try:
            full_messages = [{"role": "system", "content": self.system_prompt}, *messages]

            kwargs: Dict[str, Any] = {
                "model": self.model,
                "messages": full_messages,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
                "stream": stream,
            }
            if tools:
                kwargs["tools"] = tools
            if tool_choice:
                kwargs["tool_choice"] = tool_choice

            logger.debug(
                "agent.llm_call",
                model=self.model,
                message_count=len(full_messages),
                stream=stream,
                has_tools=tools is not None,
            )

            response = await self._client.chat.completions.create(**kwargs)
            return response

        except openai.RateLimitError as e:
            retry_after = None
            if hasattr(e, "response") and e.response is not None:
                retry_after_header = e.response.headers.get("Retry-After")
                if retry_after_header:
                    retry_after = int(retry_after_header)
            raise RateLimitError(service="KimiK2", retry_after=retry_after) from e

        except (openai.APITimeoutError, openai.APIConnectionError):
            # Let tenacity handle retries for these
            raise

        except openai.APIStatusError as e:
            raise ExternalAPIError(
                service="KimiK2",
                message=f"API error {e.status_code}: {e.message}",
                details={"status_code": e.status_code},
            ) from e

    async def _call_llm_streaming(
        self, messages: List[Dict[str, Any]]
    ) -> Any:
        """Execute a streaming LLM call that returns an async iterator."""
        return await self._call_llm(messages=messages, stream=True)

    async def generate(self, user_message: str) -> str:
        """
        Simple text-in → text-out generation (no tool calling).

        Args:
            user_message: The user's prompt.

        Returns:
            The assistant's text response.
        """
        response = await self._call_llm(
            messages=[{"role": "user", "content": user_message}]
        )
        content: str = response.choices[0].message.content or ""
        return content.strip()
