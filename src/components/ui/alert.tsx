import * as React from "react";

import { cn } from "@/lib/utils";

function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "destructive" | "success";
}) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(
        "grid w-full gap-1 rounded-lg border px-4 py-3 text-sm",
        variant === "destructive" &&
          "border-destructive/40 text-destructive bg-destructive/5",
        variant === "success" &&
          "border-emerald-600/30 bg-emerald-50 text-emerald-900",
        className,
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("font-medium", className)} {...props} />;
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-sm leading-relaxed", className)} {...props} />
  );
}

export { Alert, AlertDescription, AlertTitle };
