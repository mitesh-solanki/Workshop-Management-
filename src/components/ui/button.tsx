import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Usage: <Button variant="primary" size="md" loading={pending}>Save</Button>
 * Variants: primary | secondary | ghost | danger | outline | link
 * Sizes: sm | md | lg | icon*
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:text-white active:bg-blue-800 active:text-white [&_svg]:text-white",
        default:
          "bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:text-white active:bg-blue-800 active:text-white [&_svg]:text-white",
        secondary:
          "border border-border bg-card text-foreground shadow-sm hover:bg-slate-50",
        ghost: "text-foreground hover:bg-slate-100",
        danger:
          "bg-danger text-danger-foreground shadow-sm hover:bg-danger/90 [&_svg]:text-danger-foreground",
        destructive:
          "bg-danger text-danger-foreground shadow-sm hover:bg-danger/90 [&_svg]:text-danger-foreground",
        outline:
          "border border-border bg-card text-foreground shadow-sm hover:bg-slate-50",
        link: "text-blue-600 underline-offset-4 hover:underline",
      },
      size: {
        // Use text-xs (font-size only). Avoid text-caption here — it shares the
        // text-* namespace and can override text-white on primary buttons.
        sm: "h-9 min-h-9 gap-1.5 rounded-md px-3 text-xs has-[>svg]:px-2.5",
        md: "h-11 min-h-11 px-4 py-2 has-[>svg]:px-3",
        default: "h-11 min-h-11 px-4 py-2 has-[>svg]:px-3",
        lg: "h-12 min-h-12 rounded-xl px-6 text-base has-[>svg]:px-4",
        icon: "size-11 min-h-11 min-w-11",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 min-h-9 min-w-9",
        "icon-lg": "size-12 min-h-12 min-w-12",
        xs: "h-7 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner and disables the control. */
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";
  const isIconSize =
    size === "icon" ||
    size === "icon-xs" ||
    size === "icon-sm" ||
    size === "icon-lg";
  // Slot requires exactly one React element child — never mix a loader with asChild.
  const content = asChild ? (
    children
  ) : loading ? (
    <>
      <Loader2
        className={cn("animate-spin", isIconSize ? "size-5" : "size-4")}
        aria-hidden
      />
      {isIconSize ? null : children}
    </>
  ) : (
    children
  );

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {content}
    </Comp>
  );
}

export { Button, buttonVariants };
