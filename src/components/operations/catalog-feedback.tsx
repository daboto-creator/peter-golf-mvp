import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function CatalogFeedback({
  tone,
  title,
  message,
}: {
  tone: "error" | "success" | "info";
  title?: string;
  message: string;
}) {
  return (
    <Alert
      variant={
        tone === "error"
          ? "destructive"
          : tone === "success"
            ? "success"
            : "default"
      }
      aria-live="polite"
    >
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
