import { z } from "zod";
import { dateRangeSchema, isoDateSchema } from "@/lib/validation/common";
import {
  daysInclusive,
  isValidIsoDate,
  REPORT_MAX_RANGE_DAYS,
  REPORT_PERIODS,
  type ReportInteractionType,
  type ReportPeriod,
} from "@/lib/reports/report-period";

export const reportDateRangeSchema = dateRangeSchema;

export type ReportDateRangeInput = {
  startDate: string;
  endDate: string;
};

const personNameSchema = z.string().trim().max(200);

export const reportFiltersSchema = z
  .object({
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    agent: personNameSchema.optional().default(""),
    supervisor: personNameSchema.optional().default(""),
    type: z.enum(["", "Call", "Chat"]).optional().default(""),
    period: z.enum(REPORT_PERIODS).optional().default("custom"),
  })
  .superRefine((value, ctx) => {
    if (!isValidIsoDate(value.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Start date is not a valid calendar date.",
      });
    }
    if (!isValidIsoDate(value.endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date is not a valid calendar date.",
      });
    }
    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Start date must be on or before end date.",
      });
    }
    const span = daysInclusive(value.startDate, value.endDate);
    if (Number.isFinite(span) && span > REPORT_MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Date range cannot exceed 5 years.",
      });
    }
  });

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>;

export type ReportFilters = {
  startDate: string;
  endDate: string;
  agent: string;
  supervisor: string;
  type: ReportInteractionType;
  period: ReportPeriod;
};
