import logging
import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, Optional, List
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class DynamoDBService:

    def __init__(self, table_name: Optional[str] = None):
        self.table_name = table_name or os.environ.get('DYNAMODB_TABLE', 'evaluation-jobs')
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table(self.table_name)
        
    def load_job(self, evaluation_id: str) -> Dict[str, Any]:
        try:
            
            response = self.table.get_item(Key={'evaluation_id': evaluation_id})
            
            if 'Item' not in response:
                raise ValueError(f"Evaluation job not found: {evaluation_id}")
            
            item = response['Item']
            models = json.loads(item.get('models', '[]'))
            weights = json.loads(item.get('weights', '{}'))
            
            job_config = {
                'evaluation_id': item['evaluation_id'],
                'dataset_id': item['dataset_id'],
                'models': models,
                'weights': weights,
                'status': item.get('status', 'pending'),
                'created_at': item.get('created_at', ''),
                'total_samples': item.get('total_samples')
            }
            
            logger.info(f"Loaded job config: {len(models)} models, weights: {weights}")
            return job_config
            
        except ClientError as e:
            logger.error(f"DynamoDB error loading job {evaluation_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error loading job {evaluation_id}: {e}")
            raise

    def update_progress(
        self,
        evaluation_id: str,
        status: str,
        progress: float,
        current_model: Optional[str] = None,
        samples_processed: Optional[int] = None,
        total_samples: Optional[int] = None,
        error_message: Optional[str] = None,
        completed_at: Optional[str] = None,
        model_results: Optional[List[Dict[str, Any]]] = None,
        recommendation: Optional[Dict[str, Any]] = None,
    ) -> None:
        try:
            update_expression = "SET #status = :status, progress = :progress, updated_at = :updated_at"
            expression_attribute_names = {"#status": "status"}
            now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            expression_attribute_values: Dict[str, Any] = {
                ":status": status,
                ":progress": Decimal(str(round(progress, 2))),
                ":updated_at": now_iso,
            }

            if current_model is not None:
                update_expression += ", current_model = :current_model"
                expression_attribute_values[":current_model"] = current_model

            if samples_processed is not None:
                update_expression += ", samples_processed = :samples_processed"
                expression_attribute_values[":samples_processed"] = samples_processed

            if total_samples is not None:
                update_expression += ", total_samples = :total_samples"
                expression_attribute_values[":total_samples"] = total_samples

            if error_message is not None:
                update_expression += ", error_message = :error_message"
                expression_attribute_values[":error_message"] = error_message

            if status == "completed":
                ca = completed_at or now_iso
                mr = model_results if model_results is not None else []
                rec = recommendation if recommendation is not None else {
                    "model_identifier": "",
                    "weighted_score": 0,
                    "reasoning": "",
                }
                update_expression += ", completed_at = :completed_at, model_results = :model_results, recommendation = :recommendation"
                expression_attribute_values[":completed_at"] = ca
                expression_attribute_values[":model_results"] = json.dumps(mr)
                expression_attribute_values[":recommendation"] = json.dumps(rec)

            if status == "timeout" and model_results is not None:
                mr = model_results
                rec = recommendation if recommendation is not None else {
                    "model_identifier": "",
                    "weighted_score": 0,
                    "reasoning": "Timeout occurred before recommendation could be generated",
                }
                update_expression += ", model_results = :model_results, recommendation = :recommendation"
                expression_attribute_values[":model_results"] = json.dumps(mr)
                expression_attribute_values[":recommendation"] = json.dumps(rec)

            logger.info(
                f"Updating progress for {evaluation_id}: "
                f"status={status}, progress={progress:.1f}%, "
                f"current_model={current_model}, samples_processed={samples_processed}"
            )

            self.table.update_item(
                Key={'evaluation_id': evaluation_id},
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )

            logger.info(f"Progress updated successfully for {evaluation_id}")

        except ClientError as e:
            logger.error(f"DynamoDB error updating progress for {evaluation_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error updating progress for {evaluation_id}: {e}")
            raise
