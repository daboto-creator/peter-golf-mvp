import { z } from "zod";

import {
  optionalNonEmptyString,
  optionalUrl,
  parseEnvironment,
} from "@/env/shared";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalNonEmptyString,
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

export const publicEnv = parseEnvironment(
  publicEnvironmentSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  "public",
);
