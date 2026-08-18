import type { ButtonHTMLAttributes, ComponentType } from "react";

export interface IconComponentProps {
  size?: number;
  className?: string;
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<IconComponentProps>;
  label: string;
  variant?: "primary" | "secondary" | "warning" | "ghost";
}

export function IconButton({ icon: Icon, label, variant = "ghost", className = "", ...props }: IconButtonProps) {
  const variantClass =
    variant === "primary"
      ? "atl-button"
      : variant === "secondary"
        ? "atl-button-secondary"
        : variant === "warning"
          ? "atl-button-warning"
          : "atl-button-ghost";
  return (
    <button className={`${variantClass} ${className}`} title={label} aria-label={label} {...props}>
      <Icon size={16} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
