import './LoadingText.css';

export interface LoadingTextProps {
  text: string;
  className?: string;
  size?: 'small' | 'medium';
  durationMs?: number;
}

/** Indeterminate text loading state with a left-to-right highlight sweep. */
export function LoadingText({
  text,
  className = '',
  size = 'medium',
  durationMs = 1_450,
}: LoadingTextProps) {
  return (
    <text
      className={`loading-text loading-text--${size} ${className}`}
      flatten={false}
      style={{ animationDuration: `${Math.max(600, durationMs)}ms` }}
    >
      {text}
    </text>
  );
}
