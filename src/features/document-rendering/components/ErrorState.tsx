import { FileWarning } from "lucide-react";

export interface ErrorStateProps {
  title: string;
  description: string;
  /** Optional retry handler; when provided a retry button is shown. */
  onRetry?: () => void;
}

/** Consistent in-pane error state. */
export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
      <FileWarning className="size-8 text-warning" aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
