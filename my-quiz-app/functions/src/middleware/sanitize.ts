export type PublicQuestion = {
  id: string;
  question: string;
  questionImage: string | null;
  options: string[];
  subject: string;
  chapter: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionType: "multiple_choice" | "audio" | "fill_blank" | "image";
  language: string;
  marks: { positive: number; negative: number };
  source: {
    type: string;
    exam?: string;
    year?: number;
    shift?: string;
  };
};

const difficulties = new Set(["easy", "medium", "hard"]);
const questionTypes = new Set(["multiple_choice", "audio", "fill_blank", "image"]);

export function sanitizeQuestion(id: string, data: Record<string, unknown>): PublicQuestion {
  const sourceValue = data.source;
  const marksValue = data.marks;
  const options = data.options;

  if (
    typeof data.question !== "string" ||
    !Array.isArray(options) ||
    !options.every((option) => typeof option === "string") ||
    typeof data.subject !== "string" ||
    typeof data.chapter !== "string" ||
    typeof data.topic !== "string" ||
    typeof data.difficulty !== "string" ||
    !difficulties.has(data.difficulty) ||
    typeof data.questionType !== "string" ||
    !questionTypes.has(data.questionType) ||
    typeof data.language !== "string" ||
    typeof marksValue !== "object" ||
    marksValue === null ||
    typeof (marksValue as Record<string, unknown>).positive !== "number" ||
    typeof (marksValue as Record<string, unknown>).negative !== "number" ||
    typeof sourceValue !== "object" ||
    sourceValue === null ||
    typeof (sourceValue as Record<string, unknown>).type !== "string"
  ) {
    throw new Error(`Question ${id} is missing required public fields.`);
  }

  const source = sourceValue as Record<string, unknown>;
  const questionImage = data.questionImage;
  const publicQuestion: PublicQuestion = {
    id,
    question: data.question,
    questionImage: typeof questionImage === "string" ? questionImage : null,
    options,
    subject: data.subject,
    chapter: data.chapter,
    topic: data.topic,
    difficulty: data.difficulty as PublicQuestion["difficulty"],
    questionType: data.questionType as PublicQuestion["questionType"],
    language: data.language,
    marks: {
      positive: (marksValue as Record<string, number>).positive,
      negative: (marksValue as Record<string, number>).negative,
    },
    source: {
      type: source.type as string,
    },
  };

  if (typeof source.exam === "string") {
    publicQuestion.source.exam = source.exam;
  }
  if (typeof source.year === "number") {
    publicQuestion.source.year = source.year;
  }
  if (typeof source.shift === "string") {
    publicQuestion.source.shift = source.shift;
  }

  return publicQuestion;
}

export function sanitizeResponse<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeResponse(item)) as T;
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }

  const cleanEntries = Object.entries(value).flatMap(([key, item]) => {
    if (key === "correctOptionIndex" || key === "solution") {
      return [];
    }
    return [[key, sanitizeResponse(item)]];
  });

  return Object.fromEntries(cleanEntries) as T;
}