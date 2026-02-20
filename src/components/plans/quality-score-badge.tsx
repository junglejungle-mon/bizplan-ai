"use client";

/**
 * 사용자용 품질 점수 배지
 * - 계획서 목록 및 상세 페이지에서 사용
 * - 색상: 80+ 초록, 60+ 노랑, 40+ 주황, 40 미만 빨강
 */
export function QualityScoreBadge({
  score,
  size = "sm",
}: {
  score: number | null;
  size?: "sm" | "lg";
}) {
  if (score === null || score === undefined) {
    return (
      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
        미채점
      </span>
    );
  }

  const grade = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";

  const config = {
    A: {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
      label: "우수",
    },
    B: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-200",
      label: "보통",
    },
    C: {
      bg: "bg-orange-50",
      text: "text-orange-700",
      border: "border-orange-200",
      label: "개선필요",
    },
    D: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      label: "미흡",
    },
  }[grade];

  if (size === "lg") {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border}`}
      >
        <div className="relative w-10 h-10">
          <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
            <circle
              className="text-gray-200"
              strokeWidth="3"
              stroke="currentColor"
              fill="transparent"
              r="16"
              cx="18"
              cy="18"
            />
            <circle
              className={config.text}
              strokeWidth="3"
              strokeDasharray={`${score} ${100 - score}`}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="16"
              cx="18"
              cy="18"
            />
          </svg>
          <span
            className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${config.text}`}
          >
            {score}
          </span>
        </div>
        <div>
          <div className={`text-sm font-semibold ${config.text}`}>
            {grade}등급
          </div>
          <div className="text-xs text-gray-500">{config.label}</div>
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${config.bg} ${config.text} ${config.border}`}
    >
      <span className="font-bold">{score}</span>
      <span>{config.label}</span>
    </span>
  );
}

/**
 * 개선 제안 카드
 */
export function ImprovementSuggestions({
  suggestions,
}: {
  suggestions: string[];
}) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-1.5">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        개선 제안
      </h4>
      <ul className="space-y-1.5">
        {suggestions.map((suggestion, i) => (
          <li
            key={i}
            className="text-sm text-blue-800 flex items-start gap-2"
          >
            <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
            <span>{suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
