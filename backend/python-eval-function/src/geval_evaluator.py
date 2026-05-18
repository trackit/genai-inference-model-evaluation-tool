import os
import logging
from typing import Optional, List, Mapping
from dataclasses import dataclass

from metrics import is_metric_enabled

logger = logging.getLogger(__name__)

JUDGE_MODEL_DEFAULT = "us.meta.llama4-maverick-17b-instruct-v1:0"


@dataclass
class GEvalMetrics:
    reasoning: Optional[float] = None
    faithfulness: Optional[float] = None


class GEvalEvaluator:
    def __init__(
        self,
        metrics_config: Optional[Mapping[str, bool]] = None,
        judge_model_id: Optional[str] = None,
        region: Optional[str] = None,
    ):
        self.judge_model_id = judge_model_id or os.environ.get("GEVAL_JUDGE_MODEL", JUDGE_MODEL_DEFAULT)
        self.region = region or os.environ.get("AWS_REGION", "us-west-2")
        self.compute_reasoning = is_metric_enabled(metrics_config, 'geval_reasoning')
        self.compute_faithfulness = is_metric_enabled(metrics_config, 'geval_faithfulness')
        logger.info(
            f"GEvalEvaluator initialized with judge={self.judge_model_id}, region={self.region}, "
            f"reasoning={self.compute_reasoning}, faithfulness={self.compute_faithfulness}"
        )

    def _build_judge_model(self):
        from deepeval.models import AmazonBedrockModel

        return AmazonBedrockModel(
            model=self.judge_model_id,
            region=self.region,
        )

    def _build_reasoning_metric(self, model, task_type: str = "summarization"):
        from deepeval.metrics import GEval
        from deepeval.test_case import LLMTestCaseParams

        if task_type == "classification":
            steps = [
                "Assess whether the predicted class label is a valid category for the input text.",
                "Evaluate if the classification decision logically follows from the content of the input.",
                "Check if the chosen category captures the primary topic or intent of the document.",
                "Penalize classifications that are clearly unrelated or tangential to the input.",
                "Award higher scores when the classification is precise and well-justified by the content.",
            ]
        else:
            steps = [
                "Assess whether the actual output is logically structured and coherent.",
                "Check if the actual output follows a clear reasoning flow from the input.",
                "Evaluate whether the actual output draws correct conclusions from the source material.",
                "Penalize outputs that contain logical contradictions or non-sequiturs.",
                "Award higher scores to outputs that demonstrate clear, step-by-step reasoning.",
            ]

        return GEval(
            name="Reasoning",
            evaluation_steps=steps,
            evaluation_params=[
                LLMTestCaseParams.INPUT,
                LLMTestCaseParams.ACTUAL_OUTPUT,
            ],
            model=model,
            threshold=0.5,
            async_mode=False,
        )

    def _build_faithfulness_metric(self, model, task_type: str = "summarization"):
        from deepeval.metrics import GEval
        from deepeval.test_case import LLMTestCaseParams

        if task_type == "classification":
            steps = [
                "Check whether the predicted class label is grounded in the actual content of the input.",
                "Verify that the classification does not rely on information absent from the document.",
                "Penalize predictions that seem arbitrary or disconnected from the input text.",
                "Award higher scores when the classification directly reflects themes present in the input.",
            ]
        else:
            steps = [
                "Compare the actual output against the input source document.",
                "Identify any claims in the actual output that are not supported by the input.",
                "Check for hallucinated facts, statistics, or details not present in the source.",
                "Heavily penalize any fabricated information or unsupported extrapolation.",
                "Award higher scores when every claim in the output is directly traceable to the input.",
            ]

        return GEval(
            name="Faithfulness",
            evaluation_steps=steps,
            evaluation_params=[
                LLMTestCaseParams.INPUT,
                LLMTestCaseParams.ACTUAL_OUTPUT,
            ],
            model=model,
            threshold=0.5,
            async_mode=False,
        )

    @property
    def enabled(self) -> bool:
        return self.compute_reasoning or self.compute_faithfulness

    def evaluate(
        self,
        inputs: List[str],
        predictions: List[str],
        references: Optional[List[str]] = None,
        task_type: str = "summarization",
    ) -> GEvalMetrics:
        if not inputs or not predictions:
            logger.warning("Empty inputs or predictions, skipping G-Eval")
            return GEvalMetrics()

        if len(inputs) != len(predictions):
            logger.error("inputs and predictions length mismatch, skipping G-Eval")
            return GEvalMetrics()

        if not self.enabled:
            logger.info("Both G-Eval metrics disabled, skipping")
            return GEvalMetrics()

        try:
            model = self._build_judge_model()
            reasoning_metric = (
                self._build_reasoning_metric(model, task_type)
                if self.compute_reasoning
                else None
            )
            faithfulness_metric = (
                self._build_faithfulness_metric(model, task_type)
                if self.compute_faithfulness
                else None
            )
        except Exception as e:
            logger.error(f"Failed to initialize G-Eval components: {e}", exc_info=True)
            return GEvalMetrics()

        from deepeval.test_case import LLMTestCase

        reasoning_scores: List[float] = []
        faithfulness_scores: List[float] = []

        for idx, (inp, pred) in enumerate(zip(inputs, predictions)):
            if not pred or not pred.strip():
                logger.warning(f"Empty prediction at index {idx}, skipping G-Eval for this sample")
                continue

            test_case = LLMTestCase(
                input=inp,
                actual_output=pred,
            )

            if reasoning_metric is not None:
                try:
                    reasoning_metric.measure(test_case)
                    reasoning_scores.append(reasoning_metric.score)
                    logger.debug(
                        f"[{idx}] Reasoning score={reasoning_metric.score:.4f} reason={reasoning_metric.reason}"
                    )
                except Exception as e:
                    logger.warning(f"[{idx}] Reasoning metric failed: {e}")

            if faithfulness_metric is not None:
                try:
                    faithfulness_metric.measure(test_case)
                    faithfulness_scores.append(faithfulness_metric.score)
                    logger.debug(
                        f"[{idx}] Faithfulness score={faithfulness_metric.score:.4f} reason={faithfulness_metric.reason}"
                    )
                except Exception as e:
                    logger.warning(f"[{idx}] Faithfulness metric failed: {e}")

        result = GEvalMetrics()

        if reasoning_scores:
            result.reasoning = sum(reasoning_scores) / len(reasoning_scores)
        if faithfulness_scores:
            result.faithfulness = sum(faithfulness_scores) / len(faithfulness_scores)

        def fmt(v):
            return f"{v:.4f}" if v is not None else "N/A"

        logger.info(
            f"G-Eval complete ({len(reasoning_scores)}/{len(predictions)} samples) - "
            f"Reasoning={fmt(result.reasoning)}, Faithfulness={fmt(result.faithfulness)}"
        )

        return result
