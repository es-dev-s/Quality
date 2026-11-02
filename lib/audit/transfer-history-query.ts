import { z } from "zod";
import { serverPageSchema } from "@/lib/server/page-query";
export const transferHistoryQuerySchema = z.object({
  transferPage: serverPageSchema.shape.page,
  transferPageSize: serverPageSchema.shape.pageSize,
  auditPage: serverPageSchema.shape.page,
  auditPageSize: serverPageSchema.shape.pageSize,
  transferSearch: z.string().trim().max(200).default(""),
  auditSearch: z.string().trim().max(200).default(""),
});
