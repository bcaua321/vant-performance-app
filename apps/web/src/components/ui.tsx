/* Primitivas de UI. Superficies planas delimitadas por fio de cabelo, sem
   sombra e sem cor decorativa: a folha de dados e' o assunto, nao a moldura. */
import * as React from "react";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "danger" | "ghost" }) {
  const variants = {
    primary: "bg-ink text-panel hover:bg-black disabled:bg-faint",
    outline: "border border-rule bg-panel text-ink hover:border-ink",
    danger: "border border-alarm bg-panel text-alarm hover:bg-alarm hover:text-panel",
    ghost: "text-muted hover:text-ink",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xs px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-xs border border-rule bg-panel", className)} {...props} />;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-3.5">
      <div>
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-[0.8125rem] leading-snug text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("px-5 py-4", className)} {...props} />;
}

const fieldBase =
  "w-full rounded-xs border border-rule bg-panel px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-signal focus:outline-none";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type, ...props }, ref) {
    // Campos numericos usam a mesma grade tabular das metricas.
    return <input ref={ref} type={type} className={cx(fieldBase, type === "number" && "num", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cx(fieldBase, className)} {...props} />;
  },
);

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[0.8125rem] font-medium text-muted" title={hint}>
      {children}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-alarm">{message}</p>;
}

/* Marcador de estado no lugar do pill colorido: quadrado de 6 px + texto.
   So "Executando" recebe o ambar, porque so ele pede atencao. */
export function StatusBadge({ status }: { status: string }) {
  const marks: Record<string, { dot: string; text: string; label: string }> = {
    PENDING: { dot: "bg-faint", text: "text-muted", label: "Na fila" },
    RUNNING: { dot: "bg-signal animate-pulse", text: "text-signal", label: "Executando" },
    DONE: { dot: "bg-ink", text: "text-ink", label: "Concluída" },
    FAILED: { dot: "bg-alarm", text: "text-alarm", label: "Falhou" },
  };
  const mark = marks[status] ?? { dot: "bg-faint", text: "text-muted", label: status };
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[0.8125rem] font-medium", mark.text)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", mark.dot)} aria-hidden />
      {mark.label}
    </span>
  );
}

/* Cabecalho de tela: titulo, linha de contexto e acoes, fechado por um fio. */
export function PageHead({
  title,
  meta,
  status,
  actions,
}: {
  title: string;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-rule pb-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {status}
        </div>
        {meta && <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
