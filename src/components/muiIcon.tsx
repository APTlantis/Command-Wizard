import type { SvgIconComponent } from "@mui/icons-material";
import type { ComponentType } from "react";

export interface SizedIconProps {
  size?: number;
  className?: string;
}

export function asSizedIcon(Icon: SvgIconComponent): ComponentType<SizedIconProps> {
  return function SizedIcon({ size = 16, className }: SizedIconProps) {
    return <Icon style={{ fontSize: size }} className={className} aria-hidden="true" />;
  };
}
