import {
  notificationTokenInputSchema,
  notificationTokenOutputSchema,
} from "@/lib/api/schemas";
import { fetcher } from "@/lib/api/fetcher";

export async function updateNotificationToken(input: unknown) {
  const parsedInput = notificationTokenInputSchema.parse(input);
  const result: unknown = await fetcher("/api/notifications/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsedInput),
  });
  return notificationTokenOutputSchema.parse(result);
}
