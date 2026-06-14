import { z } from "zod";

export const cuidSchema = z.string().trim().min(1).max(64);

export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const dateRangeSchema = z
  .object({
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "Start date must be on or before end date.",
    path: ["endDate"],
  });

export const submissionKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Submission key must use letters, numbers, hyphens, or underscores."
  );

export const paginationLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(2000)
  .optional()
  .default(500);
