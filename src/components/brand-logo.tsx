import Image from "next/image";

import { BRAND_LOGOS, BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BrandLogo({
  background,
  className,
  preload = false,
}: {
  background: "light" | "dark";
  className?: string;
  preload?: boolean;
}) {
  const darkBackground = background === "dark";
  return (
    <Image
      src={darkBackground ? BRAND_LOGOS.onDark : BRAND_LOGOS.onLight}
      alt={BRAND_NAME}
      width={darkBackground ? 928 : 1254}
      height={darkBackground ? 924 : 1254}
      preload={preload}
      sizes="(max-width: 640px) 8rem, 10rem"
      className={cn("h-auto object-contain", className)}
    />
  );
}
