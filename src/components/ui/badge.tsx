import { cn } from "@/lib/utils/cn";
import { type HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        {
          "bg-blue-100 text-blue-700": variant === "default",
          "bg-gray-100 text-gray-700": variant === "secondary",
          "border border-gray-300 text-gray-700": variant === "outline",
          "bg-green-100 text-green-700": variant === "success",
          "bg-yellow-100 text-yellow-700": variant === "warning",
          "bg-red-100 text-red-700": variant === "destructive",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge, type BadgeProps };
