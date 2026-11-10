import {
  adminAiQueueOutputSchema,
  adminAnalyticsOutputSchema,
  adminDashboardOutputSchema,
  adminManageUserInputSchema,
  adminMutationOutputSchema,
  adminQuestionListOutputSchema,
  adminReviewInputSchema,
  adminUsersOutputSchema,
  bulkImportInputSchema,
} from "@/lib/api/adminSchemas";
import { fetcher } from "@/lib/api/fetcher";

async function adminRequest<T>(
  path: string,
  input: unknown,
  outputSchema: { parse: (value: unknown) => T },
): Promise<T> {
  const isFormData = input instanceof FormData;
  const response: unknown = await fetcher(`/api/admin/${path}`, {
    method: "POST",
    ...(isFormData
      ? { body: input }
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
  });
  return outputSchema.parse(response);
}

export function authorizeAdmin() {
  return adminRequest("authorize", {}, adminMutationOutputSchema);
}

export function loadAdminDashboard() {
  return adminRequest("dashboard", {}, adminDashboardOutputSchema);
}

export function loadAdminQuestions() {
  return adminRequest("questions", {}, adminQuestionListOutputSchema);
}

export function importAdminQuestions(formData: FormData) {
  return adminRequest("questions/import", formData, adminMutationOutputSchema);
}

export function loadAdminAiQueue() {
  return adminRequest("ai-queue", {}, adminAiQueueOutputSchema);
}

export function reviewAdminAiQuestion(input: unknown) {
  const validatedInput = adminReviewInputSchema.parse(input);
  return adminRequest("ai-queue/review", validatedInput, adminMutationOutputSchema);
}

export function loadAdminUsers() {
  return adminRequest("users", {}, adminUsersOutputSchema);
}

export function manageAdminUser(input: unknown) {
  const validatedInput = adminManageUserInputSchema.parse(input);
  return adminRequest("users/manage", validatedInput, adminMutationOutputSchema);
}

export function loadAdminAnalytics() {
  return adminRequest("analytics", {}, adminAnalyticsOutputSchema);
}

export function validateBulkImport(input: unknown) {
  return bulkImportInputSchema.parse(input);
}
