"use client";

import type { Question } from "@/types/question";
import type { AnswerQuizOutput } from "@/lib/api/schemas";

type QuestionCardProps = {
  question: Question;
  selectedOption: number | null;
  onSelect: (optionIndex: number) => void;
  disabled: boolean;
  result: AnswerQuizOutput | null;
};

export function QuestionCard({
  question,
  selectedOption,
  onSelect,
  disabled,
  result,
}: QuestionCardProps) {
  return (
    <article aria-labelledby={`question-${question.id}`}>
      <p>
        {question.subject} · {question.topic}
      </p>
      <h2 id={`question-${question.id}`}>{question.question}</h2>
      {question.questionImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.questionImage} alt="Question illustration" />
      ) : null}
      <fieldset disabled={disabled || result !== null}>
        <legend className="sr-only">Choose an answer</legend>
        {question.options.map((option, index) => (
          <label key={`${question.id}-${index}`} className="block">
            <input
              type="radio"
              name={`answer-${question.id}`}
              value={index}
              checked={selectedOption === index}
              onChange={() => onSelect(index)}
            />
            <span className="ml-2">{option}</span>
          </label>
        ))}
      </fieldset>
      {result ? (
        <div role="status">
          <p>{result.isCorrect ? "Correct!" : "Not quite."}</p>
          <p>{result.solution}</p>
          {result.xpEarned > 0 ? <p>+{result.xpEarned} XP</p> : null}
        </div>
      ) : null}
    </article>
  );
}