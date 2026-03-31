import logging
import json
import os
from typing import Dict

logger = logging.getLogger(__name__)


class CostCalculator:
    
    def __init__(self, pricing_file: str = None):
        if pricing_file is None:
            pricing_file = os.path.join(
                os.path.dirname(__file__), 
                '..', 
                'config', 
                'bedrock_pricing.json'
            )
        
        try:
            with open(pricing_file, 'r') as f:
                self.pricing = json.load(f)
        except Exception as e:
            logger.error(f"Failed to load pricing file {pricing_file}: {e}")
            self.pricing = {}
    
    def calculate_cost(self, model_id: str, input_tokens: int, output_tokens: int) -> float:
        if model_id not in self.pricing:
            logger.warning(f"No pricing data for model {model_id}, returning 0.0")
            return 0.0
        
        pricing = self.pricing[model_id]
        
        input_cost = (input_tokens * pricing["input_per_1k"]) / 1000
        output_cost = (output_tokens * pricing["output_per_1k"]) / 1000
        
        total_cost = input_cost + output_cost
            
        return total_cost
    
    def calculate_total_cost(self, model_id: str, total_input_tokens: int, total_output_tokens: int) -> Dict[str, float]:
        total_cost = self.calculate_cost(model_id, total_input_tokens, total_output_tokens)
        
        logger.info(
            f"Total cost for {model_id}: "
            f"${total_cost:.6f} "
            f"({total_input_tokens} input tokens, {total_output_tokens} output tokens)"
        )
        
        return {
            "total_usd": round(total_cost, 6),
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens
        }
