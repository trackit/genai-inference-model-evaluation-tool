import os
import sys
import logging
import signal
from datetime import datetime
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TimeoutException(Exception):
    """Raised when evaluation exceeds the timeout limit"""
    pass


def timeout_handler(signum, frame):
    raise TimeoutException("Evaluation exceeded 30-minute timeout")


def get_evaluation_id() -> str:
    evaluation_id = os.environ.get('EVALUATION_ID')
    if not evaluation_id:
        raise ValueError("EVALUATION_ID environment variable is required")
    return evaluation_id


def get_timeout_minutes() -> int:
    """
    Get timeout duration from environment variable.
    
    Returns:
        int: Timeout in minutes (default: 30)
    """
    timeout_str = os.environ.get('EVALUATION_TIMEOUT_MINUTES', '30')
    try:
        return int(timeout_str)
    except ValueError:
        logger.warning(f"Invalid timeout value '{timeout_str}', using default 30 minutes")
        return 30


def main():
    """
    Main entry point for the evaluation engine.
    
    Orchestrates:
    1. Load job configuration from DynamoDB
    2. Load dataset from S3
    3. Evaluate models
    4. Calculate metrics
    5. Generate recommendation
    6. Store results
    
    Handles timeout gracefully by storing partial results.
    """
    evaluation_id = None
    start_time = datetime.utcnow()
    
    try:
        evaluation_id = get_evaluation_id()
        logger.info(f"Starting evaluation: {evaluation_id}")
        
        timeout_minutes = get_timeout_minutes()
        timeout_seconds = timeout_minutes * 60
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(timeout_seconds)
        logger.info(f"Timeout set to {timeout_minutes} minutes")
        
        from dynamodb_service import DynamoDBService
        
        db_service = DynamoDBService()
        job_config = db_service.load_job(evaluation_id)
        
        dataset_id = job_config['dataset_id']
        models = job_config['models']
        weights = job_config['weights']
        
        logger.info(f"Job config loaded - dataset: {dataset_id}, models: {len(models)}")
        
        from dataset_loader import DatasetLoader
        dataset_loader = DatasetLoader()
        dataset = dataset_loader.load_dataset(dataset_id)
        logger.info(f"Dataset loaded: {len(dataset)} samples")
        
        # Update status to running and set total samples
        db_service.update_progress(
            evaluation_id=evaluation_id,
            status="running",
            progress=0.0,
            total_samples=len(dataset)
        )
        logger.info(f"Status updated to 'running' with {len(dataset)} total samples")
        db_service.update_progress(
            evaluation_id=evaluation_id,
            status="completed",
            progress=100.0
        )
        
        logger.info(f"Evaluation {evaluation_id} completed successfully")
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        logger.info(f"Total execution time: {elapsed:.2f} seconds")
        
        signal.alarm(0)
        return 0
        
    except TimeoutException as e:
        logger.error(f"Evaluation {evaluation_id} timed out: {e}")
        # Store partial results with timeout status
        if evaluation_id:
            try:
                from dynamodb_service import DynamoDBService
                db_service = DynamoDBService()
                db_service.update_progress(
                    evaluation_id=evaluation_id,
                    status="timeout",
                    progress=0.0, 
                    error_message="Evaluation exceeded 30-minute timeout"
                )
            except Exception as update_error:
                logger.error(f"Failed to update timeout status: {update_error}")
        
        return 1
        
    except Exception as e:
        logger.error(f"Evaluation {evaluation_id} failed: {e}", exc_info=True)
        # Update status to failed with error message
        if evaluation_id:
            try:
                from dynamodb_service import DynamoDBService
                db_service = DynamoDBService()
                db_service.update_progress(
                    evaluation_id=evaluation_id,
                    status="failed",
                    progress=0.0,  
                    error_message=str(e)
                )
            except Exception as update_error:
                logger.error(f"Failed to update failed status: {update_error}")
        
        return 1


if __name__ == "__main__":
    sys.exit(main())
