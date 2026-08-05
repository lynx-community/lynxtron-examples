import './LoadingSpinner.css';

/** Shared indeterminate loading indicator. */
export interface LoadingSpinnerProps {
  label?: string;
  size?: 'small' | 'medium';
  className?: string;
}

export function LoadingSpinner({ label, size = 'medium', className = '' }: LoadingSpinnerProps) {
  return (
    <view className={`loading-spinner-wrap loading-spinner-wrap--${size} ${className}`}>
      <view className={`loading-spinner loading-spinner--${size}`} />
      {label ? <text className="loading-spinner-label">{label}</text> : null}
    </view>
  );
}
