import { NextResponse, type NextRequest } from "next/server";
import {
  notificationTokenInputSchema,
  notificationTokenOutputSchema,
  rewardClaimInputSchema,
  rewardClaimOutputSchema,
} from "@/lib/api/schemas";
import { bulkImportInputSchema } from "@/lib/api/adminSchemas";

export const runtime = "nodejs";

const adminFunctions: Record<string, string> = {
  authorize: "adminAuthorize",
  dashboard: "adminDashboard",
  questions: "adminQuestions",
  "questions/import": "adminImportQuestions",
  "ai-queue": "adminAiQueue",
  "ai-queue/review": "adminReviewAiQuestion",
  users: "adminUsers",
  "users/manage": "adminManageUser",
  analytics: "adminAnalytics",
};
const applicationFunctions: Record<string, string> = {
  "notifications/token": "registerNotificationToken",
};

function isAllowedOrigin(origin: string): boolean {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return Boolean(allowedOrigins?.includes(origin));
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unclosed quoted field.");
  }
  row.push(cell);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }
  if (rows.length < 2) {
    throw new Error("CSV must include a header and at least one question.");
  }

  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""])),
  );
}

function csvQuestion(row: Record<string, string>): unknown {
  const options = row.options
    ? row.options.split("|").map((option) => option.trim())
    : ["option1", "option2", "option3", "option4", "option5"]
        .map((key) => row[key]?.trim())
        .filter((option): option is string => Boolean(option));
  const result: Record<string, unknown> = {
    question: row.question,
    ...(row.questionImage ? { questionImage: row.questionImage } : {}),
    options,
    correctOptionIndex: Number(row.correctOptionIndex),
    solution: row.solution,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    difficulty: row.difficulty,
  };
  if (row.questionType) result.questionType = row.questionType;
  if (row.language) result.language = row.language;
  if (row.positive || row.negative) {
    result.marks = {
      positive: row.positive ? Number(row.positive) : 1,
      negative: row.negative ? Number(row.negative) : 0,
    };
  }
  if (row.sourceType || row.exam || row.year || row.shift) {
    result.source = {
      type: row.sourceType || "practice",
      ...(row.exam ? { exam: row.exam } : {}),
      ...(row.year ? { year: Number(row.year) } : {}),
      ...(row.shift ? { shift: row.shift } : {}),
    };
  }
  return result;
}

async function parseImportForm(request: NextRequest): Promise<unknown> {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return null;
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new Error("Choose a non-empty import file smaller than 5 MB.");
  }

  const text = await file.text();
  const extension = file.name.toLowerCase().split(".").pop();
  let questions: unknown;
  if (extension === "json") {
    const parsed: unknown = JSON.parse(text);
    questions = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && "questions" in parsed
        ? parsed.questions
        : null;
  } else if (extension === "csv") {
    questions = parseCsv(text).map(csvQuestion);
  } else {
    throw new Error("Import file must be a .csv or .json file.");
  }

  const validated = bulkImportInputSchema.safeParse({ questions });
  if (!validated.success) {
    throw new Error("Import data is invalid. Check the required fields and answer indexes.");
  }
  return validated.data;
}

function responseMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/^\/api\//, "");
  const origin = request.headers.get("origin");
  if (origin && !isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Origin is not allowed." }, { status: 403 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.match(/^Bearer\s+\S+$/i)) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return NextResponse.json({ error: "The Firebase project is not configured." }, { status: 503 });
  }

  let functionName: string;
  let input: unknown;
  let inputContentType: string;
  if (path === "ads/reward") {
    functionName = "rewardValidator";
    const parsedInput = rewardClaimInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsedInput.success) {
      return NextResponse.json({ error: "Invalid reward proof." }, { status: 400 });
    }
    input = parsedInput.data;
    inputContentType = "application/json";
  } else if (path.startsWith("admin/")) {
    const endpoint = path.slice("admin/".length);
    functionName = adminFunctions[endpoint] ?? "";
    if (!functionName) {
      return NextResponse.json({ error: "Admin API route not found." }, { status: 404 });
    }
    try {
      input = endpoint === "questions/import"
        ? await parseImportForm(request)
        : await request.json();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid admin request.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    inputContentType = "application/json";
  } else if (applicationFunctions[path]) {
    functionName = applicationFunctions[path];
    const parsedInput: unknown = await request.json().catch(() => null);
    const validatedInput = notificationTokenInputSchema.safeParse(parsedInput);
    if (!validatedInput.success) {
      return NextResponse.json({ error: "Invalid notification token request." }, { status: 400 });
    }
    input = validatedInput.data;
    inputContentType = "application/json";
  } else {
    return NextResponse.json({ error: "API route not found." }, { status: 404 });
  }

  const upstream = await fetch(`https://asia-south1-${projectId}.cloudfunctions.net/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": inputContentType,
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const responseBody: unknown = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    const message = responseMessage(
      responseBody,
      path === "ads/reward" ? "The ad reward could not be verified." : "The admin request failed.",
    );
    return NextResponse.json({ error: message }, { status: upstream.status });
  }

  if (path === "ads/reward") {
    const parsedOutput = rewardClaimOutputSchema.safeParse(responseBody);
    if (!parsedOutput.success) {
      console.error("Reward validator returned an invalid response.", parsedOutput.error);
      return NextResponse.json({ error: "The ad reward could not be verified." }, { status: 502 });
    }
    return NextResponse.json(parsedOutput.data, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (path === "notifications/token") {
    const parsedOutput = notificationTokenOutputSchema.safeParse(responseBody);
    if (!parsedOutput.success) {
      console.error("Notification token function returned an invalid response.", parsedOutput.error);
      return NextResponse.json({ error: "The notification setting could not be updated." }, { status: 502 });
    }
    return NextResponse.json(parsedOutput.data, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.json(responseBody, {
    headers: { "Cache-Control": "no-store" },
  });
}