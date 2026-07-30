import "server-only";

import { z } from "zod";

import { optionalNonEmptyString, parseEnvironment } from "@/env/shared";
import { publicEnv } from "@/env/public";

const serverEnvironmentSchema = z.object({
  APP_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  PAYMENTS_MODE: z.enum(["disabled", "test"]).default("disabled"),
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmptyString,
});

export const serverEnv = {
  ...publicEnv,
  ...parseEnvironment(
    serverEnvironmentSchema,
    {
      APP_ENV: process.env.APP_ENV,
      PAYMENTS_MODE: process.env.PAYMENTS_MODE,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    "server",
  ),
};
