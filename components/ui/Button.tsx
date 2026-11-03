'use client';

import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cx, type ControlSize } from './cx';
import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'destructive-quiet' | 'link';

/** Icon sizes by button size (plan §2.7.3: 16 in sm/md, 20 in lg). */
export const BUTTON_ICON_SIZE: Record<ControlSize, number> = { sm: 16, md: 16, lg: 20 };
const LOADING_SPINNER_DELAY = 150; // ms — avoids a flash on fast actions

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'children'> {
  variant?: ButtonVariant;
  size?: ControlSize;
  /** Leading icon (decorative, aria-hidden). */
  icon?: LucideIcon;
  /** Trailing icon — only for menu chevrons or a forward arrow in a link. */
  iconEnd?: LucideIcon;
  loading?: boolean;
  /**
   * There is no `disabled` prop on purpose: a button can only be disabled by
   * saying why. The reason shows in a tooltip, is read by screen readers and the
   * button stays focusable (aria-disabled) so keyboard users can find out.
   */
  disabledReason?: string;
  fullWidth?: boolean;
  /** Renders a link (`<a>`) instead of a `<button>`. */
  href?: string;
  /** Forced visual state for the /dev/ui gallery only. */
  'data-state'?: 'hover' | 'active' | 'focus';
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    iconEnd: IconEnd,
    loading = false,
    disabledReason,
    fullWidth,
    href,
    className,
    onClick,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const reasonId = useId();
  const unavailable = Boolean(disabledReason) || loading;

  // Spinner only appears after 150 ms, but the button is inert straight away.
  const [spinnerOn, setSpinnerOn] = useState(false);
  useEffect(() => {
    if (!loading) {
      setSpinnerOn(false);
      return;
    }
    const t = setTimeout(() => setSpinnerOn(true), LOADING_SPINNER_DELAY);
    return () => clearTimeout(t);
  }, [loading]);

  const iconSize = BUTTON_ICON_SIZE[size];
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (unavailable) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick?.(e);
  };

  // Link variant is a text link, not a boxed button.
  if (variant === 'link') {
    const cls = cx('btn-link', className);
    if (href) {
      return (
        <Link href={href} className={cls}>
          {children}
          {IconEnd && <IconEnd size={14} strokeWidth={1.75} aria-hidden="true" className="flex-none" />}
        </Link>
      );
    }
    return (
      <button ref={ref} type={type} className={cls} onClick={handleClick} {...rest}>
        {children}
        {IconEnd && <IconEnd size={14} strokeWidth={1.75} aria-hidden="true" className="flex-none" />}
      </button>
    );
  }

  const showSpinnerAsIcon = spinnerOn && Boolean(Icon);
  const showSpinnerCentered = spinnerOn && !Icon;
  const classes = cx('btn', `btn-${size}`, `btn-${variant}`, fullWidth && 'w-full', className);

  const content = (
    <>
      {showSpinnerAsIcon ? <Spinner size={iconSize} /> : Icon && <Icon size={iconSize} strokeWidth={1.75} aria-hidden="true" />}
      <span className="btn-label" data-hidden={showSpinnerCentered ? 'true' : undefined}>
        {children}
      </span>
      {IconEnd && <IconEnd size={iconSize} strokeWidth={1.75} aria-hidden="true" className="btn-chevron" />}
      {showSpinnerCentered && (
        <span className="btn-spinner-center">
          <Spinner size={iconSize} />
        </span>
      )}
    </>
  );

  if (href && !unavailable) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  const describedBy = [rest['aria-describedby'], disabledReason ? reasonId : undefined].filter(Boolean).join(' ') || undefined;

  const button = (
    <button
      ref={ref}
      type={type}
      className={classes}
      onClick={handleClick}
      aria-disabled={unavailable || undefined}
      aria-busy={loading || undefined}
      {...rest}
      aria-describedby={describedBy}
    >
      {content}
      {disabledReason && (
        <span id={reasonId} className="sr-only-text">
          {disabledReason}
        </span>
      )}
    </button>
  );

  return disabledReason ? (
    <Tooltip content={disabledReason} className={fullWidth ? 'flex w-full' : undefined}>
      {button}
    </Tooltip>
  ) : (
    button
  );
});
