import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
  callbackUrl: z.string().trim().optional().default("/dashboard"),
});

export type LoginInput = z.infer<typeof loginSchema>;
