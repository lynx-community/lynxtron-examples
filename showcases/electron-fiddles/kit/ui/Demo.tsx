// Shared visual kit for fiddle demos. Every ported fiddle composes these, so
// the whole set reads as one product — in the repo's Fiddle Dark language,
// alongside showcases/counter and showcases/system-monitor.
//
// The palette lives in one place for the whole repo; import it rather than
// restating hex values here.
import { useCallback } from '@lynx-js/react';
import '@lynxtron-examples/config/tokens.css';
import { docsUrlFor } from '../docs';
import { bridgeSend } from '../bridge';
import './Demo.css';

/**
 * The name of a Lynxtron API this fiddle calls. Monospace because it is a
 * literal identifier, and tappable because the next thing you want after
 * seeing an API work is its reference page.
 *
 * Undocumented symbols render as plain text rather than a dead link.
 */
export function Api({ name }: { name: string }) {
  const url = docsUrlFor(name);
  const open = useCallback(() => {
    if (url) bridgeSend('open-docs', { url });
  }, [url]);

  if (!url) return <text className="demo-api demo-api-plain">{name}</text>;
  return (
    <text className="demo-api" bindtap={open}>
      {name}
    </text>
  );
}

interface DemoPageProps {
  title: string;
  /** e.g. "Supports: Win, macOS, Linux | Process: Main". */
  supports?: string;
  /** Lynxtron APIs this fiddle demonstrates, e.g. ['dialog.showOpenDialog']. */
  apis?: string[];
  children: unknown;
}

/** Scrollable page shell with a title header. */
export function DemoPage({ title, supports, apis, children }: DemoPageProps) {
  return (
    <scroll-view className="demo-page" scroll-orientation="vertical">
      <view className="demo-inner">
        <text className="demo-title">{title}</text>
        {supports ? <text className="demo-supports">{supports}</text> : null}
        {apis && apis.length ? (
          <view className="demo-apis">
            {apis.map((name) => (
              <Api key={name} name={name} />
            ))}
          </view>
        ) : null}
        {children as any}
      </view>
    </scroll-view>
  );
}

interface SectionProps {
  heading?: string;
  children: unknown;
}

/**
 * A labelled group of controls or readings.
 *
 * Without a heading there is nothing to label, so it renders as a plain group
 * rather than a panel — a bordered card drawn around a single button is heavier
 * than the button it contains.
 */
export function Section({ heading, children }: SectionProps) {
  return (
    <view className={heading ? 'demo-section' : 'demo-group'}>
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

/**
 * An action. `primary` carries the accent and should appear at most once per
 * screen — everything else stays quiet, the way showcases/counter does it.
 */
export function ActionButton({ label, onTap, variant = 'primary', disabled }: ActionButtonProps) {
  const handle = useCallback(() => {
    if (!disabled) onTap();
  }, [onTap, disabled]);
  return (
    <view
      className={`demo-btn demo-btn-${variant}${disabled ? ' demo-btn-disabled' : ''}`}
      bindtap={handle}
    >
      <text className={`demo-btn-text${variant === 'primary' ? ' demo-btn-text-primary' : ''}`}>
        {label}
      </text>
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

/**
 * One line naming what Lynxtron cannot do here and what stands in for it.
 * Only `partial` fiddles should carry one — plain text, because the point is
 * to be believed rather than noticed.
 */
export function Note({ children }: { children: unknown }) {
  return <text className="demo-note">{children as any}</text>;
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

/** Text input. `<input>` accepts value at runtime despite @lynx-js/types.
    This is a controlled input in the Lynx sense: Lynx has no `onChange` — the
    edit event is `bindinput` — so DOM-oriented "uncontrolled input" lints
    misfire here. */
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
