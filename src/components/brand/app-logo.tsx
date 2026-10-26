import { cn } from "@/lib/utils";

type AppLogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
  wordmark?: string;
  wordmarkClassName?: string;
};

const sizeClass = {
  sm: "size-6 rounded-md [&_svg]:size-3.5",
  md: "size-8 rounded-md [&_svg]:size-4",
  lg: "size-10 rounded-lg [&_svg]:size-5",
} as const;

/** Workshop mark — three vertical bay lanes. */
export function AppLogoMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-primary text-primary-foreground",
        sizeClass[size],
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M5 4.5h3.25v15H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"
          fill="currentColor"
          opacity="0.95"
        />
        <path
          d="M10.25 4.5h3.5v15h-3.5V4.5Z"
          fill="currentColor"
          opacity="0.75"
        />
        <path
          d="M15.75 4.5H19a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-3.25V4.5Z"
          fill="currentColor"
          opacity="0.55"
        />
      </svg>
    </span>
  );
}

export function AppLogo({
  className,
  size = "md",
  withWordmark = false,
  wordmark,
  wordmarkClassName,
}: AppLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <AppLogoMark size={size} />
      {withWordmark && wordmark ? (
        <span
          className={cn(
            "font-brand text-base font-semibold tracking-tight text-foreground",
            wordmarkClassName,
          )}
        >
          {wordmark}
        </span>
      ) : null}
    </span>
  );
}
