import { z } from "zod";

export const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

export const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

export function parseEnvironment<TSchema extends z.ZodType>(
  schema: TSchema,
  values: unknown,
  scope: string,
): z.output<TSchema> {
  const result = schema.safeParse(values);

  if (!result.success) {
    throw new Error(
      `Invalid ${scope} environment variables: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
