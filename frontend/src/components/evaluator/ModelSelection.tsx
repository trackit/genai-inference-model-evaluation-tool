import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { AVAILABLE_MODELS } from '@/types/evaluation';
import { motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

interface ModelSelectionProps {
  selected: string[];
  onChange: (models: string[]) => void;
}

export function ModelSelection({ selected, onChange }: ModelSelectionProps) {
  const [customInput, setCustomInput] = useState('');

  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((m) => m !== id)
        : [...selected, id],
    );
  };

  const addCustom = () => {
    const id = customInput.trim();
    if (!id || selected.includes(id)) return;
    onChange([...selected, id]);
    setCustomInput('');
  };

  const customModels = selected.filter(
    (id) => !AVAILABLE_MODELS.find((m) => m.id === id),
  );

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

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Custom Bedrock model ID
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            placeholder="e.g. us.amazon.nova-pro-v1:0"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={addCustom}
            disabled={!customInput.trim() || selected.includes(customInput.trim())}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        {customModels.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {customModels.map((id) => (
              <span
                key={id}
                className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs font-mono"
              >
                {id}
                <button onClick={() => toggle(id)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {selected.length} model{selected.length !== 1 ? 's' : ''} selected
        {selected.length < 3 && ' — select at least 3'}
      </p>
    </motion.div>
  );
}
