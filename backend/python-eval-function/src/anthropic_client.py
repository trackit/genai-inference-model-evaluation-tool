import os
import time
from functools import lru_cache
from typing import Optional

from anthropic.lib.bedrock import AnthropicBedrockMantle

from models import InvocationResult, _fail, _finish

@lru_cache(maxsize=None)
def _client(region: str) -> AnthropicBedrockMantle:
    return AnthropicBedrockMantle(aws_region=region)


def messages_stream_mantle(
    model_id: str, document: str, document_id: Optional[str] = None
) -> InvocationResult:
    ttft: Optional[float] = None
    text = ""
    in_tok = 0
    out_tok = 0

    region = os.environ.get("ANTHROPIC_MANTLE_REGION") or os.environ.get("AWS_REGION")
    if not region:
        raise ValueError("AWS_REGION is not set")

    try:
        client = _client(region)
        start = time.time()
        with client.messages.stream(
            model=model_id,
            max_tokens=8192,
            messages=[{"role": "user", "content": document}],
        ) as stream:
            for chunk in stream.text_stream:
                if ttft is None:
                    ttft = (time.time() - start) * 1000
                text += chunk
            usage = stream.get_final_message().usage
            in_tok = usage.input_tokens
            out_tok = usage.output_tokens
        return _finish(
            "messages", model_id, document_id, start, ttft, text, in_tok, out_tok
        )
    except Exception as e:
        raise _fail("messages", model_id, document_id, e) from e
