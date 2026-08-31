"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function IdentityVerificationStatus({
  message,
  shouldPoll,
}: {
  message: string;
  shouldPoll: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!shouldPoll) return;
    const interval = window.setInterval(() => router.refresh(), 2_500);
    return () => window.clearInterval(interval);
  }, [router, shouldPoll]);

  return (
    <p className="rounded-xl border p-4 text-sm" role="status">
      {message}
    </p>
  );
}
