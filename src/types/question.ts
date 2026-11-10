import type { z } from "zod";
import type { questionSchema } from "@/lib/api/schemas";

export type Question = z.infer<typeof questionSchema>;