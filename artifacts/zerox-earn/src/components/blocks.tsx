import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, LoaderCircle } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = "green",
  testId,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  accent?: "green" | "violet" | "blue";
  testId?: string;
}) {
  return (
    <article className={`metric-card metric-${accent}`} data-testid={testId}>
      <div className="metric-card-top">
        <span>{label}</span>
        <span className="metric-icon"><Icon size={18} /></span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function LoadingInline({ label = "Loading data…" }: { label?: string }) {
  return <div className="inline-state" data-testid="status-loading-inline"><LoaderCircle size={18} className="spin" /> {label}</div>;
}

export function ErrorInline({ message }: { message: string }) {
  return <div className="inline-error" role="alert"><AlertCircle size={17} /> {message}</div>;
}

export function EmptyState({
  title,
  message,
  icon: Icon,
}: {
  title: string;
  message: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty-state" data-testid="state-empty">
      {Icon && <span className="empty-state-icon"><Icon size={21} /></span>}
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status.toLowerCase()}`} data-testid={`status-${status.toLowerCase()}`}>{status}</span>;
}

export function formatCoins(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
