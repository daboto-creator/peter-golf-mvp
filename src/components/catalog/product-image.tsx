import Image from "next/image";

import { resolvePublicImagePath } from "@/lib/catalog/presentation";
import { cn } from "@/lib/utils";

export function ProductImage({
  storagePath,
  alt,
  sizes,
  className,
}: {
  storagePath: string | null;
  alt: string;
  sizes: string;
  className?: string;
}) {
  const src = resolvePublicImagePath(storagePath);

  return (
    <div
      className={cn(
        "bg-muted relative flex aspect-[4/3] overflow-hidden rounded-xl",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div
          className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center"
          role="img"
          aria-label={`Sin imagen disponible: ${alt}`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="size-10"
          >
            <path
              d="M4 19.5h16v-15H4v15Zm2-2 3.5-4 2.7 3 1.8-2 4 3.5M8.5 9.5h.01"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-xs font-medium">Imagen no disponible</span>
        </div>
      )}
    </div>
  );
}
