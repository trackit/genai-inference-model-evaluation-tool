import { Button } from '@/components/ui/button';
import { useUploadDataset } from '@/hooks/useEvaluation';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { AlertCircle, FileCheck, Upload } from 'lucide-react';
import { useState } from 'react';

interface DatasetUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
  onStartEvaluation: () => void;
  onUploadSuccess: (data: { dataset_id: string; sample_count: number }) => void;
}

export function DatasetUpload({
  file,
  onChange,
  onStartEvaluation,
  onUploadSuccess,
}: DatasetUploadProps) {
  const [dragOver, setDragOver] = useState(false);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Upload Dataset</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-8">
        Upload a CSV or JSONL file with your evaluation dataset.
      </p>

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
          CSV or JSONL, up to 50MB
        </p>
      </div>

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
                  {uploadMutation.data.sample_count} samples — Ready
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
        <Button onClick={onStartEvaluation} className="mt-6 w-full" size="lg">
          Start Evaluation
        </Button>
      )}
    </motion.div>
  );
}
