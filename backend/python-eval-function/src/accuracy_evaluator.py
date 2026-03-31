import logging
from typing import Optional, List, Dict
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class AccuracyMetrics:
    bleu: Optional[float] = None
    rouge: Optional[float] = None
    meteor: Optional[float] = None
    levenshtein: Optional[float] = None
    bertscore: Optional[float] = None
    geval_reasoning: Optional[float] = None
    geval_faithfulness: Optional[float] = None


class AccuracyEvaluator:
    
    def __init__(self):
        pass
    
    def calculate_accuracy_metrics(
        self,
        predictions: List[str],
        references: Optional[List[str]]
    ) -> Optional[AccuracyMetrics]:
        if references is None or len(references) == 0:
            logger.info("No reference outputs available, skipping accuracy metrics")
            return None
        
        if all(ref is None or ref == "" for ref in references):
            logger.info("All reference outputs are empty, skipping accuracy metrics")
            return None
        
        logger.info(f"Calculating accuracy metrics for {len(predictions)} predictions")
        
        try:
            metrics = AccuracyMetrics()
            
            metrics.bleu = self._calculate_bleu(predictions, references)
            metrics.rouge = self._calculate_rouge(predictions, references)
            metrics.meteor = self._calculate_meteor(predictions, references)
            metrics.levenshtein = self._calculate_levenshtein(predictions, references)
            metrics.bertscore = self._calculate_bertscore(predictions, references)
            
            def fmt(v): return f"{v:.4f}" if v is not None else "N/A"
            logger.info(
                f"Accuracy metrics calculated - "
                f"BLEU={fmt(metrics.bleu)}, ROUGE={fmt(metrics.rouge)}, "
                f"METEOR={fmt(metrics.meteor)}, Levenshtein={fmt(metrics.levenshtein)}, "
                f"BERTScore={fmt(metrics.bertscore)}"
            )
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating accuracy metrics: {e}", exc_info=True)
            return None
    
    def _calculate_bleu(self, predictions: List[str], references: List[str]) -> Optional[float]:
        try:
            from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction
            
            smoothing = SmoothingFunction().method1
            
            scores = []
            for pred, ref in zip(predictions, references):
                if ref and pred:
                    score = sentence_bleu(
                        [ref.split()], pred.split(),
                        smoothing_function=smoothing
                    )
                    scores.append(score)
            
            return sum(scores) / len(scores) if scores else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating BLEU: {e}")
            return None
    
    def _calculate_rouge(self, predictions: List[str], references: List[str]) -> Optional[float]:
        try:
            from rouge_score import rouge_scorer
            
            scorer = rouge_scorer.RougeScorer(['rougeL'], use_stemmer=True)
            
            scores = []
            for pred, ref in zip(predictions, references):
                if ref and pred:
                    score = scorer.score(ref, pred)
                    scores.append(score['rougeL'].fmeasure)
            
            return sum(scores) / len(scores) if scores else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating ROUGE: {e}")
            return None
    
    def _calculate_meteor(self, predictions: List[str], references: List[str]) -> Optional[float]:
        try:
            from nltk.translate.meteor_score import meteor_score
            from nltk import word_tokenize
            
            scores = []
            for pred, ref in zip(predictions, references):
                if ref and pred:
                    score = meteor_score([word_tokenize(ref)], word_tokenize(pred))
                    scores.append(score)
            
            return sum(scores) / len(scores) if scores else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating METEOR: {e}")
            return None
    
    def _calculate_levenshtein(self, predictions: List[str], references: List[str]) -> Optional[float]:
        try:
            from Levenshtein import distance
            
            scores = []
            for pred, ref in zip(predictions, references):
                if ref and pred:
                    max_len = max(len(ref), len(pred))
                    if max_len > 0:
                        similarity = 1 - (distance(ref, pred) / max_len)
                        scores.append(similarity)
            
            return sum(scores) / len(scores) if scores else 0.0
            
        except Exception as e:
            logger.error(f"Error calculating Levenshtein: {e}")
            return None
    
    def _calculate_bertscore(self, predictions: List[str], references: List[str]) -> Optional[float]:
        try:
            from bert_score import score
            
            P, R, F1 = score(predictions, references, lang='en', verbose=False)
            
            return F1.mean().item()
            
        except Exception as e:
            logger.error(f"Error calculating BERTScore: {e}")
            return None
