import logging
from typing import Optional

from anthropic_client import messages_stream_mantle
from bedrock_client import BedrockClient
from models import InvocationResult
from openai_client import converse_stream_mantle, responses_stream_mantle

logger = logging.getLogger(__name__)

_bedrock: Optional[BedrockClient] = None

def _get_bedrock() -> BedrockClient:
    global _bedrock
    if _bedrock is None:
        _bedrock = BedrockClient()
    return _bedrock


def invoke(
    model_id: str,
    document: str,
    document_id: Optional[str] = None,
    mode: str = "runtime",
) -> InvocationResult:
    if mode == "messages":
        logger.info("router: messages path model=%s", model_id)
        return messages_stream_mantle(model_id, document, document_id)
    if mode == "responses":
        logger.info("router: responses path model=%s", model_id)
        return responses_stream_mantle(model_id, document, document_id)
    if mode == "mantle":
        logger.info("router: mantle path model=%s", model_id)
        return converse_stream_mantle(model_id, document, document_id)
    logger.info("router: runtime path model=%s", model_id)
    return _get_bedrock().converse_stream(model_id, document, document_id)
