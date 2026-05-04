import logging
import time
from dataclasses import dataclass
from typing import Optional
import boto3
from botocore.exceptions import ClientError

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


MODEL_ID_MAP = {
    "amazon-nova-lite": "us.amazon.nova-lite-v1:0",
    "amazon-nova-micro": "us.amazon.nova-micro-v1:0",
    "amazon-nova": "us.amazon.nova-pro-v1:0",
}


class BedrockClient:
    
    def __init__(self):
        self.client = boto3.client('bedrock-runtime')
    
    def resolve_model_id(self, identifier: str) -> str:
        return MODEL_ID_MAP.get(identifier, identifier)
    
    def converse_stream(
        self, model_id: str, document: str, document_id: Optional[str] = None
    ) -> InvocationResult:
        start_time = time.time()
        time_to_first_token = None
        
        try:
            logger.info(
                f"converse_stream model={model_id} document={document_id or 'unknown'}"
            )

            response = self.client.converse_stream(
                modelId=model_id,
                messages=[
                    {
                        "role": "user",
                        "content": [{"text": document}]
                    }
                ],
            )
            
            response_text = ""
            input_tokens = 0
            output_tokens = 0
            first_chunk = True
            
            stream = response.get('stream')
            if stream:
                for event in stream:
                    if 'contentBlockDelta' in event:
                        delta = event['contentBlockDelta'].get('delta', {})
                        text_piece = delta.get('text', '')
                        
                        if text_piece:
                            if first_chunk:
                                time_to_first_token = (time.time() - start_time) * 1000
                                first_chunk = False
                            response_text += text_piece
                    elif 'metadata' in event:
                        metadata = event['metadata']
                        usage = metadata.get('usage', {})
                        input_tokens = usage.get('inputTokens', 0)
                        output_tokens = usage.get('outputTokens', 0)
            
            total_latency = (time.time() - start_time) * 1000
            
            if time_to_first_token is None:
                time_to_first_token = total_latency
            
            result = InvocationResult(
                response_text=response_text,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                time_to_first_token_ms=time_to_first_token,
                total_latency_ms=total_latency,
                model_id=model_id,
                document_id=document_id,
                error=None
            )
            
            logger.info(
                f"converse_stream ok model={model_id} "
                f"input_tokens={input_tokens} output_tokens={output_tokens} "
                f"ttft_ms={time_to_first_token:.2f} latency_ms={total_latency:.2f}"
            )
            
            return result
            
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code", "Unknown")
            msg = e.response.get("Error", {}).get("Message", str(e))
            error_msg = (
                f"Bedrock converse_stream failed for model \"{model_id}\" "
                f"(document {document_id or 'unknown'}): {code} — {msg}"
            )
            logger.error(
                f"converse_stream failed model_id={model_id} "
                f"document_id={document_id or 'unknown'} error={error_msg}"
            )
            raise ConverseStreamError(error_msg) from e

        except Exception as e:
            error_msg = (
                f"Bedrock converse_stream failed for model \"{model_id}\" "
                f"(document {document_id or 'unknown'}): {e!s}"
            )
            logger.error(
                f"converse_stream failed model_id={model_id} "
                f"document_id={document_id or 'unknown'} error={error_msg}",
                exc_info=True,
            )
            raise ConverseStreamError(error_msg) from e

    def evaluate_models(self, dataset, models: list, db_service, evaluation_id: str, task_instruction: str = "") -> dict:
        total_invocations = len(dataset) * len(models)
        completed_invocations = 0
        
        results_by_model = {}
        
        for model in models:
            model_id = self.resolve_model_id(model['identifier'])
            logger.info(f"Starting evaluation for model: {model_id} (from: {model['identifier']})")
            
            db_service.update_progress(
                evaluation_id=evaluation_id,
                status="running",
                progress=(completed_invocations / total_invocations) * 100,
                current_model=model_id,
                samples_processed=completed_invocations // len(models)
            )
            
            model_results = []
            
            for idx, document in enumerate(dataset.documents):
                document_id = f"doc_{idx}"
                prompt = f"{task_instruction}\n\n{document}" if task_instruction else document
                
                result = self.converse_stream(
                    model_id=model_id,
                    document=prompt,
                    document_id=document_id
                )
                
                model_results.append(result)
                completed_invocations += 1
                
                if completed_invocations % 10 == 0:
                    db_service.update_progress(
                        evaluation_id=evaluation_id,
                        status="running",
                        progress=(completed_invocations / total_invocations) * 100,
                        current_model=model_id,
                        samples_processed=completed_invocations // len(models)
                    )
            
            results_by_model[model_id] = model_results
            
            logger.info(
                f"Completed invocations for model {model_id}: "
                f"{len(model_results)} invocations, "
                f"{sum(1 for r in model_results if r.error is None)} successful"
            )
        
        logger.info(f"All model invocations complete: {completed_invocations} total invocations")
        return results_by_model
