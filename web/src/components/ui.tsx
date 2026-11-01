import { type ButtonHTMLAttributes, forwardRef, type InputHTMLAttributes, type ReactNode, useId } from "react";
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
    primary: "bg-action text-white hover:brightness-110 disabled:opacity-60",
    secondary: "border border-line bg-white text-primary hover:bg-background disabled:opacity-60",
    link: "text-action underline-offset-2 hover:underline px-0 py-0",
  }[variant];
  return (
    <button
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action ${styles} ${className}`}
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
