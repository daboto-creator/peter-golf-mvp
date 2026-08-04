import type { MetadataRoute } from "next";

import { serverEnv } from "@/env/server";

export default function robots(): MetadataRoute.Robots {
  return {
    rules:
      serverEnv.APP_ENV === "production"
        ? { userAgent: "*", allow: "/" }
        : { userAgent: "*", disallow: "/" },
  };
}
