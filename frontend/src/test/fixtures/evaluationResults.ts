import type { EvaluationResultsData } from '@/types/evaluation';

export const summarizationResults: EvaluationResultsData = {
  evaluation_id: 'eval-1',
  dataset_id: 'dataset-1',
  completed_at: '2026-06-10T12:00:00Z',
  weights: { accuracy: 50, cost: 30, latency: 20 },
  recommendation: {
    model_identifier: 'us.amazon.nova-lite-v1:0',
    weighted_score: 0.82,
    reasoning: 'Best balance of accuracy and cost for this dataset.',
  },
  models: [
    {
      identifier: 'us.amazon.nova-lite-v1:0',
      status: 'completed',
      metrics: {
        accuracy: {
          bleu: 0.42,
          rouge: 0.51,
          bertscore: 0.88,
          geval_reasoning: 0.9,
          geval_faithfulness: 0.87,
        },
        latency: {
          tokens_per_second: 120,
          time_to_first_token_ms: 180,
          total_latency_ms: 2400,
        },
        cost: {
          total_usd: 0.00012,
          input_tokens: 800,
          output_tokens: 200,
        },
      },
    },
    {
      identifier: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      status: 'completed',
      metrics: {
        accuracy: {
          bleu: 0.48,
          rouge: 0.55,
          bertscore: 0.91,
          geval_reasoning: 0.93,
          geval_faithfulness: 0.9,
        },
        latency: {
          tokens_per_second: 80,
          time_to_first_token_ms: 250,
          total_latency_ms: 3100,
        },
        cost: {
          total_usd: 0.00045,
          input_tokens: 800,
          output_tokens: 200,
        },
      },
    },
  ],
};
