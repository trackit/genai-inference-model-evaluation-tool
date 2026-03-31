import { Slider } from '@/components/ui/slider';
import type { MetricsWeights as Weights } from '@/types/evaluation';
import { motion } from 'framer-motion';

interface MetricsWeightsProps {
  value: Weights;
  onChange: (weights: Weights) => void;
}

const METRICS: { key: keyof Weights; label: string; description: string }[] = [
  {
    key: 'accuracy',
    label: 'Accuracy',
    description: 'Model correctness and quality of output',
  },
  { key: 'cost', label: 'Cost', description: 'Price per 1K tokens processed' },
  {
    key: 'latency',
    label: 'Latency',
    description: 'Response time in milliseconds',
  },
];

export function MetricsWeights({ value, onChange }: MetricsWeightsProps) {
  const handleChange = (key: keyof Weights, newVal: number) => {
    const others = METRICS.filter((m) => m.key !== key).map((m) => m.key);
    const remaining = 100 - newVal;
    const otherTotal = others.reduce((sum, k) => sum + value[k], 0);

    const updated = { ...value, [key]: newVal };
    if (otherTotal === 0) {
      updated[others[0]] = Math.round(remaining / 2);
      updated[others[1]] = remaining - updated[others[0]];
    } else {
      others.forEach((k) => {
        updated[k] = Math.round((value[k] / otherTotal) * remaining);
      });
      // Fix rounding
      const diff = 100 - Object.values(updated).reduce((a, b) => a + b, 0);
      updated[others[0]] += diff;
    }
    onChange(updated);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">
        Set Metric Weights
      </h1>
      <p className="text-sm text-muted-foreground mt-1 mb-8">
        Distribute importance across metrics. Must sum to 100%.
      </p>
      <div className="space-y-6">
        {METRICS.map((metric) => {
          const pct = value[metric.key];
          const opacity = Math.max(0.3, pct / 100);
          return (
            <div
              key={metric.key}
              className="rounded-xl bg-surface shadow-card p-5"
              style={{ opacity: Math.max(0.5, opacity) }}
            >
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-sm font-semibold">{metric.label}</span>
                  <p className="text-xs text-muted-foreground">
                    {metric.description}
                  </p>
                </div>
                <span className="text-lg font-semibold font-mono text-primary">
                  {pct}%
                </span>
              </div>
              <Slider
                value={[pct]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) => handleChange(metric.key, v)}
                className="mt-3"
              />
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-xs text-muted-foreground text-right">
        Total:{' '}
        <span className="font-mono font-semibold text-foreground">
          {value.accuracy + value.cost + value.latency}%
        </span>
      </div>
    </motion.div>
  );
}
