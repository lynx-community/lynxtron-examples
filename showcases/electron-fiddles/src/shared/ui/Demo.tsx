// Shared visual kit for fiddle demos. Every ported fiddle composes these so the
// gallery has one consistent look. Colors are baked into styles (Lynx does not
// resolve `currentColor` for svg, and CSS inheritance is limited).
import { useCallback } from '@lynx-js/react';
import './Demo.css';

interface DemoPageProps {
  title: string;
  /** e.g. "Supports: Win, macOS, Linux | Process: Main". */
  supports?: string;
  children: unknown;
}

/** Scrollable page shell with a title header. */
export function DemoPage({ title, supports, children }: DemoPageProps) {
  return (
    <scroll-view className="demo-page" scroll-orientation="vertical">
      <view className="demo-inner">
        <text className="demo-title">{title}</text>
        {supports ? <text className="demo-supports">{supports}</text> : null}
        {children as any}
      </view>
    </scroll-view>
  );
}

interface SectionProps {
  heading?: string;
  children: unknown;
}

/** A titled card grouping controls + explanation. */
export function Section({ heading, children }: SectionProps) {
  return (
    <view className="demo-section">
      {heading ? <text className="demo-section-heading">{heading}</text> : null}
      {children as any}
    </view>
  );
}

interface ActionButtonProps {
  label: string;
  onTap: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

/** Primary interactive control. */
export function ActionButton({ label, onTap, variant = 'primary', disabled }: ActionButtonProps) {
  const handle = useCallback(() => {
    if (!disabled) onTap();
  }, [onTap, disabled]);
  return (
    <view
      className={`demo-btn demo-btn-${variant}${disabled ? ' demo-btn-disabled' : ''}`}
      bindtap={handle}
    >
      <text className="demo-btn-text">{label}</text>
    </view>
  );
}

/** Explanatory paragraph. */
export function Paragraph({ children }: { children: unknown }) {
  return <text className="demo-paragraph">{children as any}</text>;
}

/** Inline monospace-ish label for API names / code. */
export function Code({ children }: { children: unknown }) {
  return <text className="demo-code">{children as any}</text>;
}

/** Live result / status line. */
export function ResultText({ children }: { children: unknown }) {
  return <text className="demo-result">{children as any}</text>;
}

interface FieldProps {
  value: string;
  placeholder?: string;
  onInput?: (value: string) => void;
}

/** Text input. `<input>` accepts value at runtime despite @lynx-js/types. */
export function Field({ value, placeholder, onInput }: FieldProps) {
  const handle = useCallback(
    (e: any) => onInput?.(e?.detail?.value ?? ''),
    [onInput],
  );
  return (
    <input
      className="demo-field"
      value={value as any}
      placeholder={placeholder}
      bindinput={handle}
    />
  );
}

/** Key/value row for info displays. */
export function KV({ k, v }: { k: string; v: string }) {
  return (
    <view className="demo-kv">
      <text className="demo-kv-key">{k}</text>
      <text className="demo-kv-val">{v}</text>
    </view>
  );
}

/** Horizontal row of controls. */
export function Row({ children }: { children: unknown }) {
  return <view className="demo-row">{children as any}</view>;
}
