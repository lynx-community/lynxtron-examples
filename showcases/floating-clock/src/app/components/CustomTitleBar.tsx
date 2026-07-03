import { useCallback } from "@lynx-js/react";

interface CustomTitleBarProps {
  title: string;
  onMinimize?: () => void;
  onClose?: () => void;
  visible?: boolean;
}

export function CustomTitleBar({
  onClose,
  visible = true,
}: CustomTitleBarProps) {

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (!visible) {
    return null;
  }

  return (
    <view className="title-bar-drag-area">
        <view className="title-bar-button" bindtap={handleClose}>
          <text className="title-bar-button-text">×</text>
      </view>
    </view>
  );
}
