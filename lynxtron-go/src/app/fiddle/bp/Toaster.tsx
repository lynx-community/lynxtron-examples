import { useEffect, useState, useCallback } from '@lynx-js/react';
import { Icon, type IconName } from './Icon';
import type { Intent as IntentType } from './constants';
import './bp.css';

export interface Toast {
  id: string;
  message: string;
  intent?: IntentType;
  icon?: IconName;
  timeout?: number;
}

let idSeq = 0;
const listeners = new Set<(toasts: Toast[]) => void>();
let currentToasts: Toast[] = [];
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() { for (const l of listeners) l(currentToasts); }

/** Global toast API — imperative like BP's Toaster.create(). */
export const AppToaster = {
  show(toast: Omit<Toast, 'id'>): string {
    const id = 'toast-' + (++idSeq);
    const withDefaults: Toast = { id, timeout: 4000, ...toast };
    currentToasts = [...currentToasts, withDefaults];
    emit();
    if (withDefaults.timeout && withDefaults.timeout > 0) {
      dismissTimers.set(id, setTimeout(() => AppToaster.dismiss(id), withDefaults.timeout));
    }
    return id;
  },
  dismiss(id: string) {
    const timer = dismissTimers.get(id);
    if (timer) { clearTimeout(timer); dismissTimers.delete(id); }
    currentToasts = currentToasts.filter(t => t.id !== id);
    emit();
  },
  clear() {
    for (const timer of dismissTimers.values()) clearTimeout(timer);
    dismissTimers.clear();
    currentToasts = [];
    emit();
  },
};

export function ToasterHost() {
  const [toasts, setToasts] = useState<Toast[]>(currentToasts);
  useEffect(() => {
    const l = (v: Toast[]) => setToasts(v);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const dismiss = useCallback((id: string) => AppToaster.dismiss(id), []);
  return (
    <view className="bp3-toast-container">
      {toasts.map(t => {
        const cls = 'bp3-toast' + (t.intent && t.intent !== 'none' ? ' bp3-intent-' + t.intent : '');
        return (
          <view key={t.id} className={cls}>
            {t.icon ? <Icon icon={t.icon} className="bp3-toast-icon" /> : null}
            <text className="bp3-toast-message">{t.message}</text>
            <view className="bp3-toast-close" bindtap={() => dismiss(t.id)}>
              <text className="bp3-toast-close-text">✕</text>
            </view>
          </view>
        );
      })}
    </view>
  );
}
