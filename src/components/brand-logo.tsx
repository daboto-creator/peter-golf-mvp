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
      src={darkBackground ? BRAND_LOGOS.dark : BRAND_LOGOS.light}
      alt={BRAND_NAME}
      width={darkBackground ? 1254 : 928}
      height={darkBackground ? 1254 : 924}
      preload={preload}
      sizes="(max-width: 640px) 8rem, 10rem"
      className={cn("h-auto object-contain", className)}
    />
  );
}
