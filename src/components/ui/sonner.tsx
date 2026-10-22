"use client"

import type { CSSProperties } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Neutral card toast (shadcn/sonner default look).
 * Status comes from the icon colour only — no coloured backgrounds.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      closeButton
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-success" aria-hidden />
        ),
        info: <InfoIcon className="size-4 text-info" aria-hidden />,
        warning: (
          <TriangleAlertIcon className="size-4 text-warning" aria-hidden />
        ),
        error: <OctagonXIcon className="size-4 text-danger" aria-hidden />,
        loading: (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg !pr-10",
          title: "group-[.toast]:text-sm group-[.toast]:font-medium group-[.toast]:text-foreground",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "!left-auto !right-2 !top-0 !bottom-0 !my-auto !h-6 !w-6 !translate-y-0 !border-0 !bg-transparent !text-muted-foreground hover:!bg-muted hover:!text-foreground",
        },
      }}
      style={
        {
          "--normal-bg": "hsl(var(--card))",
          "--normal-text": "hsl(var(--foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
