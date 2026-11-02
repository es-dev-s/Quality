import { z } from "zod";
import { serverPageSchema } from "@/lib/server/page-query";
export const usersTableQuerySchema = serverPageSchema.extend({
  search: z.string().trim().max(200).default(""),
  roleFilter: z.string().max(64).default(""),
  statusFilter: z.enum(["", "active", "inactive"]).default(""),
});
export const agentsTableQuerySchema = serverPageSchema.extend({ search: z.string().trim().max(200).default("") });
