'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';

/**
 * Toasts (plan §4.9).
 * - success / info 4 s, warning 6 s, Undo toasts 8 s, errors stay until dismissed
 * - pauses on hover and on keyboard focus
 * - max 3 visible, newest on top
 * - polite live region; error toasts use role="alert"
 */
import { resolveDuration, MAX_VISIBLE_TOASTS, type ToastType } from './duration';

export type { ToastType };

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** ms; 0 = stay until dismissed. Ignored for errors (they always stay). */
  duration?: number;
  action?: ToastAction;
}

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number; // 0 = persistent
  action?: ToastAction;
}

interface ToastApi {
  /** show(message, type, options): `options` is a duration in ms or { duration, action }. */
  show: (message: string, type?: ToastType, options?: number | ToastOptions) => string;
  success: (message: string, options?: number | ToastOptions) => string;
  info: (message: string, options?: number | ToastOptions) => string;
  warning: (message: string, options?: number | ToastOptions) => string;
  error: (message: string, options?: number | ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const dismissAll = useCallback(() => setToasts([]), []);

  const show = useCallback<ToastApi['show']>((message, type = 'info', options) => {
    const opts: ToastOptions = typeof options === 'number' ? { duration: options } : options ?? {};
    const id = `toast-${Date.now()}-${counter.current++}`;
    const item: ToastItem = {
      id,
      message,
      type,
      action: opts.action,
      duration: resolveDuration(type, Boolean(opts.action), opts.duration),
    };
    setToasts((prev) => [...prev, item]);
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, o) => show(m, 'success', o),
      info: (m, o) => show(m, 'info', o),
      warning: (m, o) => show(m, 'warning', o),
      error: (m, o) => show(m, 'error', o),
      dismiss,
      dismissAll,
    }),
    [show, dismiss, dismissAll],
  );

  const visible = toasts.slice(-MAX_VISIBLE_TOASTS);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" data-toast-viewport role="region" aria-label="Notifications" aria-live="polite">
        {visible.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const ICONS = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
} as const;

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const paused = useRef(false);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 160);
  }, [onDismiss, toast.id]);

  const start = useCallback(() => {
    if (toast.duration === 0 || paused.current) return;
    clearTimeout(timer.current);
    startedAt.current = Date.now();
    timer.current = setTimeout(close, remaining.current);
  }, [close, toast.duration]);

  const pause = useCallback(() => {
    if (toast.duration === 0) return;
    paused.current = true;
    clearTimeout(timer.current);
    remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current));
  }, [toast.duration]);

  const resume = useCallback(() => {
    paused.current = false;
    start();
  }, [start]);

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  const Icon = ICONS[toast.type];

  return (
    <div
      className={`toast toast-${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      data-leaving={leaving ? 'true' : undefined}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <Icon className="toast-icon" size={20} strokeWidth={1.75} aria-hidden="true" />
      <div className="toast-body">{toast.message}</div>
      <div className="toast-actions">
        {toast.action && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              toast.action?.onClick();
              close();
            }}
          >
            {toast.action.label}
          </Button>
        )}
        <IconButton label="Dismiss notification" icon={X} size="sm" onClick={close} />
      </div>
    </div>
  );
}
