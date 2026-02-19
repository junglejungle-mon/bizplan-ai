"use client";

import { cn } from "@/lib/utils/cn";
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
} from "react";

interface DropdownContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DropdownContext = createContext<DropdownContextValue>({
  open: false,
  onOpenChange: () => {},
});

interface DropdownMenuProps {
  children: ReactNode;
}

function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownContext.Provider value={{ open, onOpenChange: setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

function DropdownMenuTrigger({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLButtonElement>) {
  const { open, onOpenChange } = useContext(DropdownContext);

  return (
    <button
      type="button"
      className={className}
      onClick={() => onOpenChange(!open)}
      aria-expanded={open}
      {...props}
    >
      {children}
    </button>
  );
}

interface DropdownMenuContentProps extends HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

function DropdownMenuContent({
  className,
  align = "end",
  children,
  ...props
}: DropdownMenuContentProps) {
  const { open, onOpenChange } = useContext(DropdownContext);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-lg border border-gray-200 bg-white p-1 shadow-lg animate-in fade-in-0 zoom-in-95",
        {
          "left-0": align === "start",
          "left-1/2 -translate-x-1/2": align === "center",
          "right-0": align === "end",
        },
        className
      )}
      role="menu"
      {...props}
    >
      {children}
    </div>
  );
}

interface DropdownMenuItemProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  destructive?: boolean;
}

function DropdownMenuItem({
  className,
  disabled,
  destructive,
  onClick,
  ...props
}: DropdownMenuItemProps) {
  const { onOpenChange } = useContext(DropdownContext);

  return (
    <div
      role="menuitem"
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
        disabled
          ? "pointer-events-none opacity-50"
          : destructive
          ? "text-red-600 hover:bg-red-50 focus:bg-red-50"
          : "text-gray-700 hover:bg-gray-100 focus:bg-gray-100",
        className
      )}
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
        onOpenChange(false);
      }}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-1 my-1 h-px bg-gray-200", className)} {...props} />;
}

function DropdownMenuLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-2 py-1.5 text-xs font-semibold text-gray-500", className)} {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};
