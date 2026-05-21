import { Button } from '@/components/ui/button';
import type {
  EvaluationResultsData,
  ModelEvaluationResult,
} from '@/types/evaluation';
import { AVAILABLE_MODELS } from '@/types/evaluation';
import { motion } from 'framer-motion';
import { Info, RotateCcw, Trophy } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ResultsViewProps {
  data: EvaluationResultsData;
  onReset: () => void;
}

function getDisplayName(identifier: string): string {
  return AVAILABLE_MODELS.find((m) => m.id === identifier)?.name ?? identifier;
}

const MINIMUM_COST_VALUE_THRESHOLD = 0.00000001;
const MINIMUM_LATENCY_VALUE_THRESHOLD = 0.0001;

const ACCURACY_WEIGHTS: Record<string, number> = {
  // Summarization metrics
  geval_reasoning: 0.25,
  geval_faithfulness: 0.25,
  bertscore: 0.3,
  bleu: 0.05,
  rouge: 0.05,
  meteor: 0.05,
  levenshtein: 0.05,
  // Classification metrics
  f1_weighted: 0.25,
  classification_accuracy: 0.1,
  precision_macro: 0.05,
  recall_macro: 0.05,
  f1_macro: 0.05,
};

interface MetricColumn {
  key: keyof NonNullable<ModelEvaluationResult['metrics']['accuracy']>;
  label: string;
  weight: string;
}

const SUMMARIZATION_COLUMNS: MetricColumn[] = [
  { key: 'bertscore', label: 'BERTScore', weight: '30%' },
  { key: 'geval_reasoning', label: 'G-Eval Reasoning', weight: '25%' },
  { key: 'geval_faithfulness', label: 'G-Eval Faithfulness', weight: '25%' },
  { key: 'bleu', label: 'BLEU', weight: '5%' },
  { key: 'rouge', label: 'ROUGE', weight: '5%' },
  { key: 'meteor', label: 'METEOR', weight: '5%' },
  { key: 'levenshtein', label: 'Levenshtein', weight: '5%' },
];

const CLASSIFICATION_COLUMNS: MetricColumn[] = [
  { key: 'classification_accuracy', label: 'Accuracy', weight: '10%' },
  { key: 'f1_weighted', label: 'F1 Weighted', weight: '25%' },
  { key: 'f1_macro', label: 'F1 Macro', weight: '5%' },
  { key: 'precision_macro', label: 'Precision', weight: '5%' },
  { key: 'recall_macro', label: 'Recall', weight: '5%' },
  { key: 'geval_reasoning', label: 'G-Eval Reasoning', weight: '25%' },
  { key: 'geval_faithfulness', label: 'G-Eval Faithfulness', weight: '25%' },
];

function detectTaskType(
  models: ModelEvaluationResult[],
): 'classification' | 'summarization' {
  for (const m of models) {
    const acc = m.metrics.accuracy;
    if (!acc) continue;
    if (
      acc.classification_accuracy != null ||
      acc.f1_macro != null ||
      acc.f1_weighted != null
    ) {
      return 'classification';
    }
  }
  return 'summarization';
}

function computeWeightedAccuracy(model: ModelEvaluationResult): number | null {
  const acc = model.metrics.accuracy;
  if (!acc) return null;

  let weightedSum = 0;
  let weightSum = 0;

  for (const [metric, weight] of Object.entries(ACCURACY_WEIGHTS)) {
    const val = acc[metric as keyof typeof acc];
    if (val != null) {
      weightedSum += val * weight;
      weightSum += weight;
    }
  }

  return weightSum > 0 ? weightedSum / weightSum : null;
}

export function ResultsView({ data, onReset }: ResultsViewProps) {
  const models = data.models;
  const taskType = detectTaskType(models);
  const accuracyColumns =
    taskType === 'classification'
      ? CLASSIFICATION_COLUMNS
      : SUMMARIZATION_COLUMNS;

  const minCost = models.reduce(
    (min, m) => Math.min(min, m.metrics.cost.total_usd),
    Infinity,
  );
  const minLatency = models.reduce(
    (min, m) => Math.min(min, m.metrics.latency.total_latency_ms),
    Infinity,
  );

  const radarData = models.map((m) => {
    const accuracy = computeWeightedAccuracy(m);
    const costBaseline = Math.max(minCost, MINIMUM_COST_VALUE_THRESHOLD);
    const latencyBaseline = Math.max(
      minLatency,
      MINIMUM_LATENCY_VALUE_THRESHOLD,
    );
    return {
      model: getDisplayName(m.identifier),
      Accuracy: accuracy !== null ? Math.round(accuracy * 100) : 0,
      Cost: Math.round(
        (costBaseline / Math.max(m.metrics.cost.total_usd, costBaseline)) * 100,
      ),
      Latency: Math.round(
        (latencyBaseline /
          Math.max(m.metrics.latency.total_latency_ms, latencyBaseline)) *
          100,
      ),
    };
  });

  const costBarData = models.map((m) => ({
    name: getDisplayName(m.identifier),
    'Total Cost ($)': m.metrics.cost.total_usd,
  }));

  const latencyBarData = models.map((m) => ({
    name: getDisplayName(m.identifier),
    'Total Latency (ms)': m.metrics.latency.total_latency_ms,
    'Time to First Token (ms)': m.metrics.latency.time_to_first_token_ms,
  }));

  const throughputBarData = models.map((m) => ({
    name: getDisplayName(m.identifier),
    'Tokens/Second': m.metrics.latency.tokens_per_second,
  }));

  const recommendedModel = models.find(
    (m) => m.identifier === data.recommendation.model_identifier,
  );
  const recommendedName = getDisplayName(data.recommendation.model_identifier);
  const recommendedAccuracy = recommendedModel
    ? computeWeightedAccuracy(recommendedModel)
    : null;
  const recommendedLatency = recommendedModel?.metrics.latency;
  const recommendedCost = recommendedModel?.metrics.cost.total_usd ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Recommended card */}
      <div className="rounded-xl bg-surface shadow-hero p-6">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-widest">
            Recommended
          </span>
        </div>
        <h2 className="text-2xl font-semibold mt-1">{recommendedName}</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {data.recommendation.reasoning}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <Stat
            label="Accuracy"
            value={
              recommendedAccuracy !== null
                ? `${Math.round(recommendedAccuracy * 100)}%`
                : 'N/A'
            }
          />
          <Stat label="Total Cost" value={`$${recommendedCost.toFixed(6)}`} />
          <Stat
            label="Total Latency"
            value={`${recommendedLatency?.total_latency_ms ?? 0}ms`}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
          <Stat
            label="Tokens/Second"
            value={`${recommendedLatency?.tokens_per_second.toFixed(1) ?? 0}`}
          />
          <Stat
            label="Time to First Token"
            value={`${recommendedLatency?.time_to_first_token_ms ?? 0}ms`}
          />
          <Stat
            label="Input/Output Tokens"
            value={`${recommendedModel?.metrics.cost.input_tokens ?? 0} / ${recommendedModel?.metrics.cost.output_tokens ?? 0}`}
          />
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface shadow-card p-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Metric Balance
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="model" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fontSize: 10 }}
              />
              <Radar
                name="Accuracy"
                dataKey="Accuracy"
                stroke="hsl(226, 70%, 55%)"
                fill="hsl(226, 70%, 55%)"
                fillOpacity={0.15}
              />
              <Radar
                name="Cost"
                dataKey="Cost"
                stroke="hsl(142, 76%, 36%)"
                fill="hsl(142, 76%, 36%)"
                fillOpacity={0.1}
              />
              <Radar
                name="Latency"
                dataKey="Latency"
                stroke="hsl(38, 92%, 50%)"
                fill="hsl(38, 92%, 50%)"
                fillOpacity={0.1}
              />
              <Tooltip />
              <Legend wrapperStyle={{ paddingTop: 30 }} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <Info
              className="h-4 w-4 shrink-0 text-primary mt-0.5"
              aria-hidden
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">
                Higher is better
              </span>{' '}
              : Accuracy = more accurate, Cost = cheaper, Latency = faster.
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-surface shadow-card p-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Total Cost Comparison
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={costBarData} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => `$${Number(value).toFixed(6)}`} />
              <Bar
                dataKey="Total Cost ($)"
                fill="hsl(142, 76%, 36%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 - Latency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-surface shadow-card p-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Latency Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={latencyBarData} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => `${Number(value)}ms`} />
              <Legend verticalAlign="top" height={36} />
              <Bar
                dataKey="Total Latency (ms)"
                fill="hsl(226, 70%, 55%)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="Time to First Token (ms)"
                fill="hsl(38, 92%, 50%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl bg-surface shadow-card p-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Throughput (Tokens/Second)
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={throughputBarData} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(1)} t/s`}
              />
              <Bar
                dataKey="Tokens/Second"
                fill="hsl(262, 83%, 58%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Accuracy Breakdown Table */}
      <div className="rounded-xl bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Accuracy Breakdown
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {taskType === 'classification'
              ? 'Classification metric scores and their weights used to compute the final weighted accuracy'
              : 'Individual metric scores and their weights used to compute the final weighted accuracy'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Model
                </th>
                {accuracyColumns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-2 text-right font-medium text-muted-foreground"
                  >
                    <div>{col.label}</div>
                    <div className="text-[10px] font-normal">
                      ({col.weight})
                    </div>
                  </th>
                ))}
                <th className="px-4 py-2 text-right font-medium text-muted-foreground bg-muted/50">
                  <div>Weighted Accuracy</div>
                  <div className="text-[10px] font-normal">(Final)</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {models
                .slice()
                .sort(
                  (a, b) =>
                    (computeWeightedAccuracy(b) ?? 0) -
                    (computeWeightedAccuracy(a) ?? 0),
                )
                .map((m) => {
                  const acc = m.metrics.accuracy;
                  const weightedAcc = computeWeightedAccuracy(m);
                  const isRecommended =
                    m.identifier === data.recommendation.model_identifier;
                  const formatScore = (val: number | undefined) =>
                    val != null ? `${Math.round(val * 100)}%` : '-';
                  return (
                    <tr
                      key={m.identifier}
                      className={isRecommended ? 'bg-primary/5' : ''}
                    >
                      <td className="px-4 py-3 font-medium font-mono">
                        {getDisplayName(m.identifier)}
                        {isRecommended && (
                          <Trophy className="inline-block ml-2 h-3 w-3 text-primary" />
                        )}
                      </td>
                      {accuracyColumns.map((col) => (
                        <td
                          key={col.key}
                          className="px-4 py-3 font-mono text-right"
                        >
                          {formatScore(acc?.[col.key])}
                        </td>
                      ))}
                      <td className="px-4 py-3 font-mono text-right font-semibold bg-muted/30">
                        {weightedAcc !== null
                          ? `${Math.round(weightedAcc * 100)}%`
                          : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* All models table */}
      <div className="rounded-xl bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            All Results
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  #
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                  Model
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  Accuracy
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  Total Cost
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  Total Latency
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  TTFT
                </th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                  Tokens/s
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {models
                .slice()
                .sort(
                  (a, b) =>
                    (computeWeightedAccuracy(b) ?? 0) -
                    (computeWeightedAccuracy(a) ?? 0),
                )
                .map((m, i) => {
                  const accuracy = computeWeightedAccuracy(m);
                  const isRecommended =
                    m.identifier === data.recommendation.model_identifier;
                  return (
                    <tr
                      key={m.identifier}
                      className={isRecommended ? 'bg-primary/5' : ''}
                    >
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-medium font-mono">
                        {getDisplayName(m.identifier)}
                        {isRecommended && (
                          <Trophy className="inline-block ml-2 h-3 w-3 text-primary" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-right">
                        {accuracy !== null
                          ? `${Math.round(accuracy * 100)}%`
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-3 font-mono text-right">
                        ${m.metrics.cost.total_usd.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 font-mono text-right">
                        {m.metrics.latency.total_latency_ms}ms
                      </td>
                      <td className="px-4 py-3 font-mono text-right">
                        {m.metrics.latency.time_to_first_token_ms}ms
                      </td>
                      <td className="px-4 py-3 font-mono text-right">
                        {m.metrics.latency.tokens_per_second.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <Button variant="outline" onClick={onReset} className="gap-2">
        <RotateCcw className="h-4 w-4" />
        New Evaluation
      </Button>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-lg font-semibold font-mono mt-0.5">{value}</p>
    </div>
  );
}
