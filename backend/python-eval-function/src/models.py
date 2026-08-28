import logging
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

class ConverseStreamError(RuntimeError):
    pass


@dataclass
class InvocationResult:
    response_text: str
    input_tokens: int
    output_tokens: int
    time_to_first_token_ms: float
    total_latency_ms: float
    model_id: str
    document_id: Optional[str] = None
    error: Optional[str] = None


def _finish(
    api: str,
    model_id: str,
    document_id: Optional[str],
    start: float,
    ttft: Optional[float],
    text: str,
    in_tok: int,
    out_tok: int,
) -> InvocationResult:
    total = (time.time() - start) * 1000
    if ttft is None:
        ttft = total

    logger.info(
        "mantle %s ok model=%s ttft_ms=%.2f latency_ms=%.2f "
        "input_tokens=%d output_tokens=%d",
        api, model_id, ttft, total, in_tok, out_tok,
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


def _fail(
    api: str, model_id: str, document_id: Optional[str], e: Exception
) -> ConverseStreamError:
    error_msg = (
        f"Mantle {api} failed for model \"{model_id}\" "
        f"(document {document_id or 'unknown'}): {e!s}"
    )
    logger.error(
        "mantle %s failed model_id=%s document_id=%s error=%s",
        api, model_id, document_id or "unknown", error_msg,
        exc_info=True,
    )
    return ConverseStreamError(error_msg)
