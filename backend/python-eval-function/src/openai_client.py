import logging
import os
import time
from functools import lru_cache
from typing import Optional

from openai import OpenAI
from openai.providers import bedrock

from models import ConverseStreamError, InvocationResult

logger = logging.getLogger(__name__)

#INFO: prefix tuple, expand when new models need /openai/v1 path
_OPENAI_PATH_PREFIXES = ("xai.", "google.gemma-4")


def _mantle_base_url(model_id: str, region: str) -> str:
    path = "openai/v1" if any(model_id.startswith(p) for p in _OPENAI_PATH_PREFIXES) else "v1"
    return f"https://bedrock-mantle.{region}.api.aws/{path}"


# mirrors the single boto3 client on the runtime
# path so mantle latency is measured on a warm connection too.
@lru_cache(maxsize=None)
def _client(base_url: str, region: str) -> OpenAI:
    return OpenAI(provider=bedrock(region=region, base_url=base_url))


def converse_stream_mantle(
    model_id: str, document: str, document_id: Optional[str] = None
) -> InvocationResult:
    ttft: Optional[float] = None
    text = ""
    in_tok = 0
    out_tok = 0

    try:
        region = os.environ.get("AWS_REGION")
        if not region:
            raise ValueError("AWS_REGION is not set")
        client = _client(_mantle_base_url(model_id, region), region)
        start = time.time()
        stream = client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": document}],
            stream=True,
            stream_options={"include_usage": True},
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                if ttft is None:
                    ttft = (time.time() - start) * 1000
                text += delta
            if chunk.usage:
                in_tok = chunk.usage.prompt_tokens
                out_tok = chunk.usage.completion_tokens

        total = (time.time() - start) * 1000
        if ttft is None:
            ttft = total

        logger.info(
            "mantle converse_stream ok model=%s ttft_ms=%.2f latency_ms=%.2f "
            "input_tokens=%d output_tokens=%d",
            model_id, ttft, total, in_tok, out_tok,
        )
        return InvocationResult(
            response_text=text,
            input_tokens=in_tok,
            output_tokens=out_tok,
            time_to_first_token_ms=ttft,
            total_latency_ms=total,
            model_id=model_id,
            document_id=document_id,
        )
    except Exception as e:
        error_msg = (
            f"Mantle converse_stream failed for model \"{model_id}\" "
            f"(document {document_id or 'unknown'}): {e!s}"
        )
        logger.error(
            "mantle converse_stream failed model_id=%s document_id=%s error=%s",
            model_id, document_id or "unknown", error_msg,
            exc_info=True,
        )
        raise ConverseStreamError(error_msg) from e
