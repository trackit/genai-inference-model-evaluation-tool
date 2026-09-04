import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  AVAILABLE_MODELS,
  ModelMode,
  type SelectedModel,
} from '@/types/evaluation';
import { motion } from 'framer-motion';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

const MODEL_MODE_OPTIONS: Array<{ value: ModelMode; label: string }> = [
  { value: ModelMode.RUNTIME, label: 'Runtime' },
  { value: ModelMode.MANTLE, label: 'Mantle (Chat Completions)' },
  { value: ModelMode.RESPONSES, label: 'Mantle (Responses)' },
  { value: ModelMode.MESSAGES, label: 'Mantle (Messages)' },
];

interface ModelSelectionProps {
  selected: SelectedModel[];
  onChange: (models: SelectedModel[]) => void;
}

export function ModelSelection({ selected, onChange }: ModelSelectionProps) {
  const [customInput, setCustomInput] = useState('');

  const toggle = (id: string) => {
    const exists = selected.find((m) => m.id === id);
    onChange(
      exists
        ? selected.filter((m) => m.id !== id)
        : [...selected, { id, mode: ModelMode.RUNTIME }],
    );
  };

  const setMode = (
    currentId: string,
    currentMode: ModelMode,
    newMode: ModelMode,
  ) => {
    if (selected.some((m) => m.id === currentId && m.mode === newMode)) return;
    onChange(
      selected.map((m) =>
        m.id === currentId && m.mode === currentMode
          ? { ...m, mode: newMode }
          : m,
      ),
    );
  };

  const addCustom = () => {
    const id = customInput.trim();
    if (!id) return;
    const used = new Set(
      selected.filter((m) => m.id === id).map((m) => m.mode),
    );
    const mode = Object.values(ModelMode).find((m) => !used.has(m));
    if (!mode) return;
    onChange([...selected, { id, mode }]);
    setCustomInput('');
  };

  const customModels = selected.filter(
    ({ id: id }) => !AVAILABLE_MODELS.find((m) => m.id === id),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Select Models</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Choose 3 or more models to evaluate against your dataset.
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
          const selectedEntry = selected.find((m) => m.id === model.id);
          const isSelected = !!selectedEntry;
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
            disabled={
              !customInput.trim() ||
              Object.values(ModelMode).every((m) =>
                selected.some(
                  (s) => s.id === customInput.trim() && s.mode === m,
                ),
              )
            }
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>

        {customModels.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {customModels.map(({ id, mode }) => (
              <div
                key={`${id}-${mode}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
              >
                <span className="text-sm font-mono text-foreground">{id}</span>

                <div className="flex items-center gap-0.5 rounded-full bg-muted p-1">
                  {MODEL_MODE_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={mode === value}
                      onClick={() => setMode(id, mode, value)}
                      className={cn(
                        'rounded-full px-3 py-1 text-sm font-semibold transition-colors',
                        mode === value
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      selected.filter((m) => !(m.id === id && m.mode === mode)),
                    )
                  }
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
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
