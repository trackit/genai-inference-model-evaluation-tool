import os
import sys
import logging
import signal
from datetime import datetime, UTC
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
    db_service = None
    start_time = datetime.now(UTC)
    partial_results = None
    
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
        
        from bedrock_client import BedrockClient
        bedrock_client = BedrockClient()
        
        has_summaries = dataset.summaries is not None
        if has_summaries:
            task_instruction = """You are a content summarization expert, understand the given content ,
summarize it meaningfully without hallucination and should not miss any important
information while summarizing. Output ONLY the summary, nothing else."""
        else:
            task_instruction = ""
        
        results_by_model = bedrock_client.evaluate_models(dataset, models, db_service, evaluation_id, task_instruction)
        logger.info(f"Model evaluation complete: {len(results_by_model)} models evaluated")
        
        from accuracy_evaluator import AccuracyEvaluator
        accuracy_evaluator = AccuracyEvaluator()
        
        accuracy_results = {}
        all_references = dataset.summaries if dataset.summaries else dataset.class_labels

        for model_id, invocation_results in results_by_model.items():
            successful_indices = [i for i, r in enumerate(invocation_results) if r.error is None]
            predictions = [invocation_results[i].response_text for i in successful_indices]
            references = [all_references[i] for i in successful_indices] if all_references else None
            
            accuracy_metrics = accuracy_evaluator.calculate_accuracy_metrics(predictions, references)
            accuracy_results[model_id] = accuracy_metrics
            
            if accuracy_metrics:
                logger.info(f"Accuracy metrics calculated for {model_id}")
            else:
                logger.info(f"No accuracy metrics for {model_id} (no reference outputs)")
        
        logger.info(f"Accuracy evaluation complete for {len(accuracy_results)} models")
        
        from geval_evaluator import GEvalEvaluator
        geval_evaluator = GEvalEvaluator()
        
        for model_id, invocation_results in results_by_model.items():
            successful_indices = [i for i, r in enumerate(invocation_results) if r.error is None]
            predictions = [invocation_results[i].response_text for i in successful_indices]
            inputs = [dataset.documents[i] for i in successful_indices]
            references = [all_references[i] for i in successful_indices] if all_references else None
            
            logger.info(f"Running G-Eval for model {model_id} on {len(predictions)} samples")
            geval_metrics = geval_evaluator.evaluate(inputs, predictions, references)
            
            acc = accuracy_results.get(model_id)
            if acc is None:
                from accuracy_evaluator import AccuracyMetrics
                acc = AccuracyMetrics()
                accuracy_results[model_id] = acc
            
            acc.geval_reasoning = geval_metrics.reasoning
            acc.geval_faithfulness = geval_metrics.faithfulness
            
            logger.info(f"G-Eval complete for {model_id}")
        
        logger.info(f"G-Eval evaluation complete for all models")
        
        from cost_calculator import CostCalculator
        cost_calculator = CostCalculator()
        
        model_results = []
        for model_id, invocation_results in results_by_model.items():
            successful = [r for r in invocation_results if r.error is None]
            error_count = len(invocation_results) - len(successful)
            
            avg_latency = sum(r.total_latency_ms for r in successful) / len(successful) if successful else 0
            avg_ttft = sum(r.time_to_first_token_ms for r in successful) / len(successful) if successful else 0
            total_input = sum(r.input_tokens for r in successful)
            total_output = sum(r.output_tokens for r in successful)
            tokens_per_sec = (total_output / (avg_latency / 1000)) if avg_latency > 0 else 0
            
            cost_data = cost_calculator.calculate_total_cost(model_id, total_input, total_output)
            
            acc = accuracy_results.get(model_id)
            accuracy_dict = None
            if acc:
                accuracy_dict = {
                    "bleu": acc.bleu,
                    "rouge": acc.rouge,
                    "meteor": acc.meteor,
                    "levenshtein": acc.levenshtein,
                    "bertscore": acc.bertscore,
                    "geval_reasoning": acc.geval_reasoning,
                    "geval_faithfulness": acc.geval_faithfulness,
                }
            
            model_results.append({
                "identifier": model_id,
                "status": "completed" if successful else "failed",
                "error_count": error_count,
                "metrics": {
                    "accuracy": accuracy_dict,
                    "latency": {
                        "tokens_per_second": round(tokens_per_sec, 2),
                        "time_to_first_token_ms": round(avg_ttft, 2),
                        "total_latency_ms": round(avg_latency, 2),
                    },
                    "cost": cost_data,
                },
            })
        
        partial_results = {
            'model_results': model_results,
            'weights': weights
        }
        
        from model_recommender import ModelRecommender
        recommender = ModelRecommender()
        recommendation_obj = recommender.recommend(model_results, weights)
        
        recommendation = {
            "model_identifier": recommendation_obj.model_identifier,
            "weighted_score": recommendation_obj.weighted_score,
            "reasoning": recommendation_obj.reasoning,
        }
        
        logger.info(f"Recommendation: {recommendation}")
        
        db_service.update_progress(
            evaluation_id=evaluation_id,
            status="completed",
            progress=100.0,
            model_results=model_results,
            recommendation=recommendation,
        )
        
        logger.info(f"Evaluation {evaluation_id} completed successfully")
        elapsed = (datetime.now(UTC) - start_time).total_seconds()
        logger.info(f"Total execution time: {elapsed:.2f} seconds")
        
        signal.alarm(0)
        return 0
        
    except TimeoutException as e:
        logger.error(f"Evaluation {evaluation_id} timed out: {e}")
        if evaluation_id and db_service:
            try:
                if partial_results and partial_results.get('model_results'):
                    logger.info(f"Storing partial results for {len(partial_results['model_results'])} models")
                    try:
                        from model_recommender import ModelRecommender
                        recommender = ModelRecommender()
                        recommendation_obj = recommender.recommend(
                            partial_results['model_results'],
                            partial_results['weights']
                        )
                        recommendation = {
                            "model_identifier": recommendation_obj.model_identifier,
                            "weighted_score": recommendation_obj.weighted_score,
                            "reasoning": f"{recommendation_obj.reasoning} (partial results due to timeout)",
                        }
                    except Exception as rec_error:
                        logger.error(f"Failed to generate recommendation from partial results: {rec_error}")
                        recommendation = {
                            "model_identifier": "",
                            "weighted_score": 0.0,
                            "reasoning": "Timeout occurred before recommendation could be generated",
                        }
                    
                    db_service.update_progress(
                        evaluation_id=evaluation_id,
                        status="timeout",
                        progress=0.0,
                        error_message="Evaluation exceeded 30-minute timeout. Partial results stored.",
                        model_results=partial_results['model_results'],
                        recommendation=recommendation
                    )
                else:
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
        if evaluation_id and db_service:
            try:
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
