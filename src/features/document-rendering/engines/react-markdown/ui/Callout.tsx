/**
 * Callout / alert components used by markdown directives:
 *
 *   :::note     Note     (primary accent)
 *   :::info     Info     (blue)
 *   :::success  Success  (green)
 *   :::warning  Warning  (amber)
 *   :::danger   Danger   (red)
 *
 * A custom title can be provided with a bracketed label:
 *   :::warning[Proceed carefully]
 */
import {
  AlertTriangle as AlertTriangleIcon,
  CircleAlert as CircleAlertIcon,
  CircleCheck as CircleCheckIcon,
  Info as InfoIcon,
  Lightbulb as LightbulbIcon,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

export type CalloutVariant = "note" | "info" | "success" | "warning" | "danger";

const VARIANT_CONFIG: Record<
  CalloutVariant,
  { label: string; icon: ComponentType<{ className?: string }>; className: string; iconClassName: string }
> = {
  note: {
    label: "Note",
    icon: LightbulbIcon,
    className: "border-primary/40 bg-primary-soft",
    iconClassName: "text-primary",
  },
  info: {
    label: "Info",
    icon: InfoIcon,
    className: "border-info/40 bg-info-soft",
    iconClassName: "text-info",
  },
  success: {
    label: "Success",
    icon: CircleCheckIcon,
    className: "border-success/40 bg-success-soft",
    iconClassName: "text-success",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangleIcon,
    className: "border-warning/40 bg-warning-soft",
    iconClassName: "text-warning",
  },
  danger: {
    label: "Danger",
    icon: CircleAlertIcon,
    className: "border-danger/40 bg-danger-soft",
    iconClassName: "text-danger",
  },
};

export interface CalloutProps {
  variant: CalloutVariant;
  title?: ReactNode;
  children: ReactNode;
}

export function Callout({ variant, title, children }: CalloutProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;
  return (
    <aside
      className={`my-5 rounded-lg border px-4 py-3 ${config.className}`}
      data-callout={variant}
      role="note"
    >
      <div className="flex gap-3">
        <Icon className={`mt-1 size-4 shrink-0 ${config.iconClassName}`} aria-hidden={true} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title ?? config.label}</p>
          <div className="mt-1 text-sm [&>p]:my-1.5 [&>p]:leading-relaxed">{children}</div>
        </div>
      </div>
    </aside>
  );
}

/** Convenience wrappers matching the spec's required component names. */
export function Note(props: Omit<CalloutProps, "variant">) {
  return <Callout variant="note" {...props} />;
}
export function Info(props: Omit<CalloutProps, "variant">) {
  return <Callout variant="info" {...props} />;
}
export function Success(props: Omit<CalloutProps, "variant">) {
  return <Callout variant="success" {...props} />;
}
export function Warning(props: Omit<CalloutProps, "variant">) {
  return <Callout variant="warning" {...props} />;
}
export function Danger(props: Omit<CalloutProps, "variant">) {
  return <Callout variant="danger" {...props} />;
}
