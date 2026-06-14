import { dateRangeSchema } from "@/lib/validation/common";

export const reportDateRangeSchema = dateRangeSchema;

export type ReportDateRangeInput = {
  startDate: string;
  endDate: string;
};
