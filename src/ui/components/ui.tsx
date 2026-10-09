// Shared interface primitives.

import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import s from './ui.module.css';

type Variant = 'default' | 'primary' | 'ghost';

export function Button({
  variant = 'default',
  small,
  iconOnly,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean; iconOnly?: boolean }) {
  const cls = [
    s.button,
    variant === 'primary' && s.primary,
    variant === 'ghost' && s.ghost,
    small && s.small,
    iconOnly && s.iconOnly,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button type="button" className={cls} {...rest} />;
}

export function ButtonLink({
  to,
  variant = 'default',
  small,
  children,
  ...rest
}: {
  to: string;
  variant?: Variant;
  small?: boolean;
  children: ReactNode;
  'aria-label'?: string;
}) {
  const cls = [s.button, variant === 'primary' && s.primary, variant === 'ghost' && s.ghost, small && s.small]
    .filter(Boolean)
    .join(' ');
  return (
    <Link to={to} className={cls} {...rest}>
      {children}
    </Link>
  );
}

export function Card({
  title,
  children,
  className,
  style,
  ...rest
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  'aria-live'?: 'polite' | 'off';
  'data-tone'?: string;
}) {
  return (
    <section className={[s.card, className].filter(Boolean).join(' ')} style={style} {...rest}>
      {title && <h3 className={s.cardTitle}>{title}</h3>}
      {children}
    </section>
  );
}

/** One-sentence goal that opens every screen. */
export function GoalLine({ children, step }: { children: ReactNode; step?: ReactNode }) {
  return (
    <p className={s.goal}>
      <span className={s.goalIcon} aria-hidden>
        {step ?? '◎'}
      </span>
      <span>{children}</span>
    </p>
  );
}

export type Tone = 'info' | 'good' | 'bad' | 'warn';

/** The "What just happened?" card: 1 to 2 plain sentences plus an optional "Go deeper". */
export function WhatHappened({ children, deeper, tone = 'info', title = 'What just happened?' }: {
  children: ReactNode;
  deeper?: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <Card title={title} className={s.happened} data-tone={tone} aria-live="polite">
      <div className={s.happenedBody}>{children}</div>
      {deeper && (
        <details className={s.deeper}>
          <summary>Go deeper</summary>
          <div className={s.deeperBody}>{deeper}</div>
        </details>
      )}
    </Card>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className={s.tooltipWrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span role="tooltip" id={id} className={s.tooltip}>
          {label}
        </span>
      )}
    </span>
  );
}

export function Pill({ tone, children }: { tone?: 'teal' | 'violet' | 'green' | 'coral' | 'amber' | 'blue'; children: ReactNode }) {
  return (
    <span className={s.pill} data-tone={tone}>
      {children}
    </span>
  );
}

export function Meter({
  label,
  value,
  display,
  color,
}: {
  label: string;
  value: number;
  display?: string;
  color?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={s.meter} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className={s.meterHead}>
        <span>{label}</span>
        <span className={s.meterValue}>{display ?? `${pct.toFixed(0)}%`}</span>
      </div>
      <div className={s.meterTrack}>
        <div className={s.meterFill} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={s.slider}>
      <div className={s.sliderHead}>
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{format ? format(value) : value}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <div className="faint" style={{ fontSize: '0.82rem' }}>{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={s.segmented} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} aria-pressed={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

export function Stack({ children, gap }: { children: ReactNode; gap?: number }) {
  return (
    <div className={s.stack} style={gap ? { gap } : undefined}>
      {children}
    </div>
  );
}

export function Row({ children, gap, style }: { children: ReactNode; gap?: number; style?: React.CSSProperties }) {
  return (
    <div className={s.row} style={{ ...(gap ? { gap } : {}), ...style }}>
      {children}
    </div>
  );
}

export const pct = (x: number, digits = 1) => `${(100 * x).toFixed(digits)}%`;
