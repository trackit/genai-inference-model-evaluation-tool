import { Button } from '@/components/ui/button';
import { useUploadDataset } from '@/hooks/useEvaluation';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  FileCheck,
  FileText,
  Loader2,
  Sparkles,
  Tag,
  Upload,
} from 'lucide-react';
import { useState } from 'react';

interface DatasetUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
  onStartEvaluation: () => void;
  onUploadSuccess: (data: { dataset_id: string; sample_count: number }) => void;
  isStarting?: boolean;
}

type TaskType = 'summarization' | 'classification';

const TASK_TYPES: {
  id: TaskType;
  label: string;
  icon: React.ElementType;
  description: string;
  autoDetect: string;
  requiredColumns: string[];
  optionalColumns: string[];
  metrics: string[];
  csvExample: string;
  jsonlExample: string;
}[] = [
  {
    id: 'summarization',
    label: 'Summarization',
    icon: FileText,
    description:
      'Evaluate how well models summarize documents against reference summaries.',
    autoDetect:
      'Summarization is detected when your file includes both "document" and "summary" columns.',
    requiredColumns: ['document', 'summary'],
    optionalColumns: [],
    metrics: ['BLEU', 'ROUGE', 'METEOR', 'BERTScore', 'G-Eval'],
    csvExample:
      'document,summary\n"The European Space Agency announced...","ESA announced a new Mars mission."\n"Scientists have discovered...","A new exoplanet was found."',
    jsonlExample:
      '{"document": "The European Space Agency announced...", "summary": "ESA announced a new Mars mission."}\n{"document": "Scientists have discovered...", "summary": "A new exoplanet was found."}',
  },
  {
    id: 'classification',
    label: 'Classification',
    icon: Tag,
    description:
      'Evaluate text classification accuracy against ground-truth labels.',
    autoDetect:
      'Classification is detected when your file includes both "document" and "class" columns.',
    requiredColumns: ['document', 'class'],
    optionalColumns: [],
    metrics: [
      'Accuracy',
      'Precision (macro)',
      'Recall (macro)',
      'F1 (macro & weighted)',
    ],
    csvExample:
      'document,class\n"I absolutely loved this product!","positive"\n"Terrible experience, never again.","negative"\n"It was okay, nothing special.","neutral"',
    jsonlExample:
      '{"document": "I absolutely loved this product!", "class": "positive"}\n{"document": "Terrible experience, never again.", "class": "negative"}\n{"document": "It was okay, nothing special.", "class": "neutral"}',
  },
];

type FormatTab = 'csv' | 'jsonl';

export function DatasetUpload({
  file,
  onChange,
  onStartEvaluation,
  onUploadSuccess,
  isStarting = false,
}: DatasetUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskType>('summarization');
  const [formatTab, setFormatTab] = useState<FormatTab>('csv');
  const uploadMutation = useUploadDataset();

  const handleFile = (f: File) => {
    uploadMutation.reset();
    onChange(f);
    uploadMutation.mutate(f, {
      onSuccess: (data) => {
        onUploadSuccess({
          dataset_id: data.dataset_id,
          sample_count: data.sample_count,
        });
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const task = TASK_TYPES.find((t) => t.id === activeTask)!;
  const TaskIcon = task.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Upload Dataset</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-6">
        Upload a CSV or JSONL file. Summarization requires{' '}
        <span className="font-mono text-foreground/80">document</span> and{' '}
        <span className="font-mono text-foreground/80">summary</span>;
        classification requires{' '}
        <span className="font-mono text-foreground/80">document</span> and{' '}
        <span className="font-mono text-foreground/80">class</span>. Task type
        is inferred from your columns.
      </p>

      {/* ── Task type tabs ── */}
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
          Dataset type
        </p>
        <div className="flex gap-2">
          {TASK_TYPES.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === activeTask;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTask(t.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Task description card ── */}
      <motion.div
        key={activeTask}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-xl border border-border bg-surface p-4 mb-6 space-y-4"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2">
            <TaskIcon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{task.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {task.description}
            </p>
          </div>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Required columns
            </p>
            <div className="flex flex-wrap gap-1.5">
              {task.requiredColumns.map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-mono font-medium text-primary"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5"></p>

            <span className="text-xs text-muted-foreground italic"></span>
          </div>
        </div>

        {/* Metrics */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            Evaluation metrics
          </p>
          <div className="flex flex-wrap gap-1.5">
            {task.metrics.map((m) => (
              <span
                key={m}
                className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground/70"
              >
                <Sparkles className="mr-1 h-2.5 w-2.5 text-muted-foreground" />
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Auto-detection note */}
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
          <div className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              Auto-detection:{' '}
            </span>
            {task.autoDetect}
          </p>
        </div>

        {/* Format example */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">
              Format example
            </p>
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setFormatTab('csv')}
                className={cn(
                  'px-2.5 py-1 font-mono transition-colors',
                  formatTab === 'csv'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'bg-surface text-muted-foreground hover:text-foreground',
                )}
              >
                CSV
              </button>
              <button
                onClick={() => setFormatTab('jsonl')}
                className={cn(
                  'px-2.5 py-1 font-mono transition-colors border-l border-border',
                  formatTab === 'jsonl'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'bg-surface text-muted-foreground hover:text-foreground',
                )}
              >
                JSONL
              </button>
            </div>
          </div>
          <pre className="rounded-lg bg-muted/50 border border-border px-3 py-2.5 text-xs font-mono text-foreground/80 overflow-x-auto whitespace-pre leading-relaxed">
            {formatTab === 'csv' ? task.csvExample : task.jsonlExample}
          </pre>
        </div>
      </motion.div>

      {/* ── Upload zone ── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-xl border-2 border-dashed p-12 text-center transition-all',
          dragOver ? 'border-primary bg-primary/5' : 'border-border bg-surface',
        )}
      >
        <input
          type="file"
          accept=".csv,.jsonl,.json"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploadMutation.isPending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">
          Drop your file here or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          CSV or JSONL · up to 50 MB · min 10 rows
        </p>
      </div>

      {/* ── Upload status ── */}
      {file && (
        <div
          className={cn(
            'mt-4 flex items-center gap-3 rounded-lg p-4 shadow-card',
            uploadMutation.isSuccess
              ? 'bg-accent/5'
              : uploadMutation.isError
                ? 'bg-destructive/5'
                : 'bg-surface',
          )}
        >
          {uploadMutation.isPending && (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">Uploading dataset…</span>
            </>
          )}
          {uploadMutation.isSuccess && (
            <>
              <FileCheck className="h-4 w-4 text-accent" />
              <div>
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {uploadMutation.data.sample_count} samples —{' '}
                  {uploadMutation.data.has_summary
                    ? 'Summarization'
                    : uploadMutation.data.has_class
                      ? 'Classification'
                      : 'Ready'}
                </span>
              </div>
            </>
          )}
          {uploadMutation.isError && (
            <>
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                {uploadMutation.error.message}
              </span>
            </>
          )}
        </div>
      )}

      {uploadMutation.isSuccess && (
        <Button
          onClick={onStartEvaluation}
          className="mt-6 w-full"
          size="lg"
          disabled={isStarting}
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting…
            </>
          ) : (
            'Start Evaluation'
          )}
        </Button>
      )}
    </motion.div>
  );
}
