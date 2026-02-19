import { Badge } from "@/components/ui/badge";

interface QualityBadgeProps {
  score: number | null | undefined;
  showLabel?: boolean;
}

export function QualityBadge({ score, showLabel = true }: QualityBadgeProps) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  if (score >= 80) {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
        {showLabel && "우수 "}{score}점
      </Badge>
    );
  }
  if (score >= 60) {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px]">
        {showLabel && "보통 "}{score}점
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
      {showLabel && "개선필요 "}{score}점
    </Badge>
  );
}
