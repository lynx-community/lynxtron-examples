export interface PasteEventLike {
  detail?: {
    value?: unknown;
    text?: unknown;
  };
}

/**
 * Normalise the native paste payloads used by Lynx input implementations.
 * Newer runtimes may provide the complete value; older implementations only
 * expose the inserted text.
 */
export function valueFromPasteEvent(currentValue: string, event: PasteEventLike): string | null {
  const value = event?.detail?.value;
  if (typeof value === 'string') return value;

  const text = event?.detail?.text;
  return typeof text === 'string' ? currentValue + text : null;
}
