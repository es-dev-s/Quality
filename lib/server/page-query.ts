import { z } from "zod";

export const serverPageSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(20), z.literal(50)])).default(20),
});
export type ServerPage = z.infer<typeof serverPageSchema>;
export type PageInfo = ServerPage & { total: number; totalPages: number; start: number; end: number };

export function pageInfo(total: number, input: ServerPage): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, totalPages);
  return { page, pageSize: input.pageSize, total, totalPages, start: total ? (page - 1) * input.pageSize + 1 : 0, end: Math.min(page * input.pageSize, total) };
}

export function pageItems<T>(rows: T[], input: ServerPage) {
  const pagination = pageInfo(rows.length, input);
  return { rows: rows.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize), pagination };
}
