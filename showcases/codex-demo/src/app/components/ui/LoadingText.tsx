import './LoadingText.css';

export interface LoadingTextProps {
  text: string;
  className?: string;
  size?: 'compact' | 'small' | 'medium';
  durationMs?: number;
  maxLines?: number;
}

/**
 * Indeterminate work-state text with a left-to-right highlight sweep.
 *
 * Keep `flatten={false}`: Lynx needs an independent text layer to repaint the
 * animated gradient. Callers provide layout through `className`; this component
 * owns only typography, truncation, and the animation.
 */
export function LoadingText({
  text,
  className = '',
  size = 'medium',
  durationMs = 1_450,
  maxLines = 1,
}: LoadingTextProps) {
  return (
    <text
      className={`loading-text loading-text--${size} ${className}`}
      flatten={false}
      text-maxline={String(Math.max(1, maxLines))}
      style={{ animationDuration: `${Math.max(600, durationMs)}ms` }}
    >
      {text}
    </text>
  );
}
