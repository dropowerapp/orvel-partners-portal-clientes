import {
  type ButtonHTMLAttributes,
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from "react";
import { useTranslation } from "react-i18next";

export function Spinner({ fullScreen = false }: { fullScreen?: boolean }) {
  const { t } = useTranslation();
  const spinner = (
    <div role="status" className="flex items-center gap-3 text-sm text-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-action" aria-hidden="true" />
      <span>{t("app.loading")}</span>
    </div>
  );
  return fullScreen ? <div className="flex min-h-dvh items-center justify-center">{spinner}</div> : spinner;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "link"; busy?: boolean };

export function Button({ variant = "primary", busy = false, className = "", disabled, children, ...props }: ButtonProps) {
  const styles = {
    primary: "bg-action text-white hover:bg-primary disabled:opacity-60",
    secondary: "border border-line bg-white text-primary hover:bg-background disabled:opacity-60",
    link: "text-action underline-offset-2 hover:underline px-0 py-0",
  }[variant];
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode };

export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField(
  { label, error, hint, className = "", ...props },
  ref,
) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-primary">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="rounded-md border border-line bg-white px-3 py-2.5 text-base text-primary placeholder:text-silver focus:border-action focus:outline-2 focus:outline-action/30 aria-[invalid]:border-red-600"
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
});

export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-line bg-background text-primary",
    success: "border-green-200 bg-green-50 text-green-800",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

/** Rótulo pequeno em maiúsculas espaçadas, por cima dos títulos (como nos documentos da marca). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-wordmark uppercase">{children}</p>;
}

/** Título das páginas das áreas de cliente e equipa. */
export function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-9">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="text-3xl leading-tight font-light tracking-tight text-primary sm:text-[2.75rem]">{title}</h1>
      <span className="my-4 block h-px w-10 bg-silver" />
      {children && <div className="max-w-prose text-base leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

const CONTROL =
  "rounded-md border border-line bg-white px-3 py-2.5 text-base text-primary placeholder:text-silver focus:border-action focus:outline-2 focus:outline-action/30 aria-[invalid]:border-red-600 disabled:bg-background disabled:text-muted";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
};

export const SelectField = forwardRef<HTMLSelectElement, SelectProps>(function SelectField(
  { label, error, options, className = "", ...props },
  ref,
) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-primary">
        {label}
      </label>
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={CONTROL}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
});

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string };

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextAreaField(
  { label, error, className = "", ...props },
  ref,
) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-primary">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={CONTROL}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
});

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode };

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxProps>(function CheckboxField(
  { label, hint, className = "", ...props },
  ref,
) {
  const id = useId();
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1 size-4 shrink-0 accent-action"
        {...props}
      />
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-primary">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
});

export type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  const styles = {
    neutral: "bg-background text-primary-deep border-line",
    info: "bg-blue-50 text-blue-800 border-blue-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    success: "bg-green-50 text-green-800 border-green-200",
    danger: "bg-red-50 text-red-800 border-red-200",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${styles}`}>
      {children}
    </span>
  );
}

/** Bloco branco com título, para as secções da ficha do processo. */
export function Card({ title, actions, children }: { title?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="portal-card">
      {(title || actions) && (
        <div className="portal-card-header">
          {title && <h2 className="text-base font-semibold text-primary">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="portal-card-content">{children}</div>
    </section>
  );
}

/** Lista de pares rótulo/valor (dados só para leitura). */
export function DataList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{item.label}</dt>
          <dd className="mt-0.5 text-sm text-primary">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
