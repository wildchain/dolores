"use client";
import { cn, repColor, statusCfg } from "@/lib/data";

export function Card({
  children,
  className,
  hover,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "transition-all duration-200",
        hover && "cursor-pointer",
        className,
      )}
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: 20,
      }}
      onMouseEnter={
        hover
          ? e => {
              (e.currentTarget as HTMLDivElement).style.boxShadow =
                "var(--shadow-md)";
            }
          : undefined
      }
      onMouseLeave={
        hover
          ? e => {
              (e.currentTarget as HTMLDivElement).style.boxShadow =
                "var(--shadow-sm)";
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export function CardLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(className)}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "var(--fs-12)",
        color: "var(--fg-subtle)",
        textTransform: "uppercase",
        letterSpacing: ".14em",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

export function Badge({ cap }: { cap: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "var(--fs-12)",
        fontWeight: 600,
        letterSpacing: ".06em",
        padding: "3px 10px",
        borderRadius: "999px",
        background: "var(--primary-subtle)",
        color: "var(--accent)",
        border: "1px solid var(--primary)",
      }}
    >
      {cap}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const c = statusCfg(status);
  return (
    <span
      style={{
        display: "inline-flex",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "var(--fs-12)",
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${c.borderColor}`,
        background: c.bg,
        color: c.color,
      }}
    >
      {c.label}
    </span>
  );
}

export function RepRing({
  score,
  size = 52,
}: {
  score: number;
  size?: number;
}) {
  const pct = score / 100;
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (circ * pct) / 100;
  const col = repColor(pct * 100);
  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth="4"
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="absolute inset-0 flex items-center justify-center font-semibold"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "var(--fs-12)",
          color: col,
        }}
      >
        {pct.toFixed(0)}
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}) {
  type StyleMap = Record<string, React.CSSProperties>;
  const v: StyleMap = {
    primary: {
      background: "var(--accent)",
      color: "var(--fg-inverse)",
      border: "1px solid var(--accent)",
    },
    secondary: {
      background: "var(--primary-subtle)",
      color: "var(--accent)",
      border: "1px solid var(--primary)",
    },
    danger: {
      background: "transparent",
      color: "var(--danger)",
      border: "1px solid var(--danger)",
    },
    ghost: {
      background: "transparent",
      color: "var(--fg-muted)",
      border: "1px solid transparent",
    },
  };
  const s: StyleMap = {
    sm: {
      padding: "6px 12px",
      fontSize: "var(--fs-12)",
      borderRadius: "var(--radius-sm)",
    },
    md: {
      padding: "8px 16px",
      fontSize: "var(--fs-14)",
      borderRadius: "var(--radius-sm)",
    },
    lg: {
      padding: "10px 20px",
      fontSize: "var(--fs-16)",
      borderRadius: "var(--radius)",
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "font-semibold transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
        className,
      )}
      style={{ ...v[variant], ...s[size] }}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  className,
  ...props
}: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label
          style={{
            display: "block",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "var(--fs-12)",
            color: "var(--fg-subtle)",
            marginBottom: 6,
          }}
        >
          {label}
        </label>
      )}
      <input
        className={cn("w-full outline-none transition-colors", className)}
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)",
          padding: "9px 14px",
          color: "var(--fg)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "var(--fs-14)",
        }}
        {...props}
      />
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  valueClass,
  valueStyle,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-sm)",
        padding: 12,
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "var(--fs-12)",
          color: "var(--fg-subtle)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        className={cn(valueClass)}
        style={{
          fontSize: "var(--fs-16)",
          fontWeight: 600,
          color: "var(--fg)",
          ...valueStyle,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "var(--fs-12)",
            color: "var(--fg-muted)",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
