from typing import Any, Dict, List, Optional

from bedrock_client import InvocationResult
from dataset_loader import Dataset


class DatasetMother:
  @staticmethod
  def summarization(
    documents: Optional[List[str]] = None,
    summaries: Optional[List[str]] = None,
  ) -> Dataset:
    docs = documents or ["First document.", "Second document."]
    sums = summaries or ["Summary one.", "Summary two."]
    samples = [
      {"document": doc, "summary": summary}
      for doc, summary in zip(docs, sums)
    ]
    return Dataset(samples)

  @staticmethod
  def classification(
    documents: Optional[List[str]] = None,
    labels: Optional[List[str]] = None,
  ) -> Dataset:
    docs = documents or ["Sports news.", "Tech article."]
    classes = labels or ["sports", "tech"]
    samples = [
      {"document": doc, "class_label": label}
      for doc, label in zip(docs, classes)
    ]
    return Dataset(samples)

  @staticmethod
  def open(documents: Optional[List[str]] = None) -> Dataset:
    docs = documents or ["Open-ended prompt."]
    return Dataset([{"document": doc} for doc in docs])


class InvocationResultMother:
  @staticmethod
  def success(
    response_text: str = "model output",
    input_tokens: int = 10,
    output_tokens: int = 20,
    model_id: str = "test-model-v1",
    document_id: str = "doc_0",
  ) -> InvocationResult:
    return InvocationResult(
      response_text=response_text,
      input_tokens=input_tokens,
      output_tokens=output_tokens,
      time_to_first_token_ms=50.0,
      total_latency_ms=200.0,
      model_id=model_id,
      document_id=document_id,
      error=None,
    )

  @staticmethod
  def failed(model_id: str = "test-model-v1") -> InvocationResult:
    return InvocationResult(
      response_text="",
      input_tokens=0,
      output_tokens=0,
      time_to_first_token_ms=0.0,
      total_latency_ms=0.0,
      model_id=model_id,
      error="bedrock failure",
    )


class ModelResultMother:
  @staticmethod
  def basic(
    identifier: str = "model-a",
    default_weight: float = 0.8,
    tokens_per_second: float = 100.0,
    total_usd: float = 0.01,
  ) -> Dict[str, Any]:
    return {
      "identifier": identifier,
      "status": "completed",
      "error_count": 0,
      "metrics": {
        "accuracy": {
          "bleu": default_weight,
          "rouge": default_weight,
          "meteor": default_weight,
          "levenshtein": default_weight,
          "bertscore": default_weight,
          "geval_reasoning": None,
          "geval_faithfulness": None,
          "classification_accuracy": None,
          "precision_macro": None,
          "recall_macro": None,
          "f1_macro": None,
          "f1_weighted": None,
        },
        "latency": {
          "tokens_per_second": tokens_per_second,
          "time_to_first_token_ms": 50.0,
          "total_latency_ms": 200.0,
        },
        "cost": {
          "total_usd": total_usd,
          "input_tokens": 100,
          "output_tokens": 50,
        },
      },
    }

  @staticmethod
  def with_classification(
    identifier: str,
    default_weight: float,
    f1_weighted: float,
    total_cost: float,
    tokens_per_second: float,
  ) -> Dict[str, Any]:
    return {
      "identifier": identifier,
      "status": "completed",
      "error_count": 0,
      "metrics": {
        "accuracy": {
          "bleu": None,
          "rouge": None,
          "meteor": None,
          "levenshtein": None,
          "bertscore": None,
          "geval_reasoning": None,
          "geval_faithfulness": None,
          "classification_accuracy": default_weight,
          "precision_macro": default_weight,
          "recall_macro": default_weight,
          "f1_macro": default_weight,
          "f1_weighted": f1_weighted,
        },
        "latency": {
          "tokens_per_second": tokens_per_second,
          "time_to_first_token_ms": 50.0,
          "total_latency_ms": 200.0,
        },
        "cost": {
          "total_usd": total_cost,
          "input_tokens": 100,
          "output_tokens": 50,
        },
      },
    }


class JobConfigMother:
  @staticmethod
  def summarization(evaluation_id: str = "eval-1") -> Dict[str, Any]:
    return {
      "evaluation_id": evaluation_id,
      "dataset_id": "dataset-1",
      "models": [{"identifier": "amazon-nova-lite"}],
      "weights": {"accuracy": 0.5, "latency": 0.3, "cost": 0.2},
      "metrics": {
        "bleu": True,
        "rouge": True,
        "meteor": False,
        "levenshtein": True,
        "bertscore": False,
        "classification_accuracy": False,
        "precision_macro": False,
        "recall_macro": False,
        "f1_macro": False,
        "f1_weighted": False,
        "geval_reasoning": False,
        "geval_faithfulness": False,
      },
      "status": "pending",
    }
