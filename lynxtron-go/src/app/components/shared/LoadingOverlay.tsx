import './LoadingOverlay.css';
import { PlatformOverlay } from './PlatformOverlay';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

/**
 * Shared, full-work-area loading overlay for long-running operations.
 * Keep the API small so Example Artifact is just the first consumer.
 */
export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <PlatformOverlay priority={160}>
      <view event-through={false} className="LoadingOverlay" catchtap={() => {}}>
        <view className="LoadingOverlayContent">
          <view className="LoadingOverlaySpinner" />
          {message ? <text className="LoadingOverlayMessage">{message}</text> : null}
        </view>
      </view>
    </PlatformOverlay>
  );
}
