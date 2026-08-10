import { useState } from '@lynx-js/react';
import './Button.css';

/** Shared desktop button behavior and visual state configuration. */
export interface ButtonProps {
  children?: any;
  className?: string;
  disabled?: boolean;
  selected?: boolean;
  border?: boolean;
  variant?: 'default' | 'ghost' | 'danger';
  borderColor?: string;
  hoverBackgroundColor?: string;
  hoverBorderColor?: string;
  activeBackgroundColor?: string;
  focusBorderColor?: string;
  focusRingColor?: string;
  selectedBorderColor?: string;
  onTap?: () => void;
  style?: Record<string, unknown>;
}

export function Button({
  children,
  className = '',
  disabled = false,
  selected = false,
  border = false,
  variant = 'default',
  borderColor,
  hoverBackgroundColor,
  hoverBorderColor,
  activeBackgroundColor,
  focusBorderColor,
  focusRingColor,
  selectedBorderColor,
  onTap,
  style,
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const visualStyle: Record<string, unknown> = { ...style };

  const defaultHoverBackground = variant === 'danger'
    ? 'rgba(208, 70, 70, 0.1)'
    : variant === 'ghost'
      ? 'rgba(232, 234, 238, 0.72)'
      : 'rgba(225, 228, 233, 0.58)';
  const defaultHoverBorder = variant === 'danger'
    ? 'rgba(208, 70, 70, 0.34)'
    : 'rgba(117, 123, 134, 0.28)';

  if (!border) {
    visualStyle.borderColor = 'transparent';
    visualStyle.boxShadow = 'none';
  } else if (selected) {
    visualStyle.borderColor = selectedBorderColor ?? 'rgba(109, 116, 128, 0.3)';
  } else {
    visualStyle.borderColor = borderColor ?? 'rgba(117, 123, 134, 0.28)';
  }
  if (!disabled && hovered && !selected) {
    visualStyle.backgroundColor = hoverBackgroundColor ?? defaultHoverBackground;
    visualStyle.borderColor = border ? hoverBorderColor ?? defaultHoverBorder : 'transparent';
  }
  if (!disabled && pressed) {
    visualStyle.backgroundColor = activeBackgroundColor ?? 'rgba(210, 214, 221, 0.72)';
  }
  if (!disabled && border && focused) {
    visualStyle.borderColor = focusBorderColor ?? 'rgba(88, 126, 188, 0.48)';
    visualStyle.boxShadow = `0 0 0 2px ${focusRingColor ?? 'rgba(88, 126, 188, 0.13)'}`;
  }

  return (
    <view
      className={`ui-button ui-button--${variant} ${border ? '' : 'ui-button--borderless'} ${selected ? 'ui-button--selected' : ''} ${disabled ? 'ui-button--disabled' : ''} ${className}`}
      bindtap={disabled ? undefined : onTap}
      bindmouseenter={disabled ? undefined : () => setHovered(true)}
      bindmouseleave={disabled ? undefined : () => {
        setHovered(false);
        setPressed(false);
      }}
      bindmousedown={disabled ? undefined : () => setPressed(true)}
      bindmouseup={disabled ? undefined : () => setPressed(false)}
      bindfocus={disabled ? undefined : () => setFocused(true)}
      bindblur={disabled ? undefined : () => setFocused(false)}
      style={visualStyle}
    >
      {children}
    </view>
  );
}
