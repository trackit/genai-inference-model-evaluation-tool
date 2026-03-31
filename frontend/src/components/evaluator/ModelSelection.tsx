import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { AVAILABLE_MODELS } from '@/types/evaluation';
import { motion } from 'framer-motion';

interface ModelSelectionProps {
  selected: string[];
  onChange: (models: string[]) => void;
}

export function ModelSelection({ selected, onChange }: ModelSelectionProps) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((m) => m !== id)
        : [...selected, id],
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Select Models</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Choose 2 or more models to evaluate against your dataset.
      </p>
      <div className="rounded-xl bg-surface shadow-card overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-0 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border px-4 py-3">
          <span className="w-8" />
          <span>Model</span>
          <span>Provider</span>
          <span>Context</span>
          <span className="text-right">$/1K tokens</span>
        </div>
        {AVAILABLE_MODELS.map((model) => {
          const isSelected = selected.includes(model.id);
          return (
            <button
              key={model.id}
              onClick={() => toggle(model.id)}
              className={cn(
                'grid w-full grid-cols-[auto_1fr_1fr_1fr_1fr] gap-0 items-center px-4 py-3 text-sm text-left transition-colors border-b border-border last:border-0',
                isSelected ? 'bg-primary/[0.03]' : 'hover:bg-muted/50',
              )}
            >
              <div className="w-8">
                <Checkbox checked={isSelected} />
              </div>
              <span className="font-medium font-mono text-foreground">
                {model.name}
              </span>
              <span className="text-muted-foreground">{model.provider}</span>
              <span className="text-muted-foreground font-mono">
                {model.contextWindow}
              </span>
              <span className="text-right font-mono">
                ${model.costPer1kTokens}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        {selected.length} model{selected.length !== 1 ? 's' : ''} selected
        {selected.length < 2 && ' — select at least 2'}
      </p>
    </motion.div>
  );
}
