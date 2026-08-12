from dataclasses import dataclass
from typing import Optional


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
