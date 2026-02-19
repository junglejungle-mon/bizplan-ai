"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface CompleteStepProps {
  profileScore: number;
  scoreBreakdown: Record<string, number> | null;
  missingData: string[];
}

export function CompleteStep({ profileScore, scoreBreakdown, missingData }: CompleteStepProps) {
  const router = useRouter();

  const scoreLabels: Record<string, string> = {
    data_completeness: "데이터",
    strategic_clarity: "전략",
    evidence_strength: "에비던스",
    market_understanding: "시장",
    team_capability: "팀역량",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <Card className="w-full max-w-2xl p-8">
        <div className="text-center mb-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">사업 프로필 구축 완료!</h1>
          <p className="mt-2 text-gray-500">
            프로필 완성도: <span className="font-bold text-blue-600">{profileScore}%</span>
          </p>
        </div>

        <div className="h-3 rounded-full bg-gray-100 mb-6">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000"
            style={{ width: `${profileScore}%` }}
          />
        </div>

        {scoreBreakdown && (
          <div className="grid grid-cols-5 gap-2 mb-6">
            {Object.entries(scoreBreakdown).map(([key, value]) => (
              <div key={key} className="text-center p-2 rounded-lg bg-gray-50">
                <p className="text-lg font-bold text-blue-600">{value}</p>
                <p className="text-xs text-gray-500">{scoreLabels[key] || key}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4 mb-6">
          <p className="text-sm text-gray-600">
            {profileScore >= 80
              ? "충분한 데이터가 확보되었습니다! 고품질 사업계획서를 자동 작성할 수 있습니다."
              : profileScore >= 60
              ? "기본 사업계획서 작성이 가능합니다. 회사 정보에서 추가 인터뷰로 품질을 더 높일 수 있습니다."
              : "일부 데이터가 부족합니다. 회사 정보에서 추가 인터뷰를 진행하면 사업계획서 품질이 향상됩니다."}
          </p>

          {missingData.length > 0 && (
            <div className="rounded-lg bg-yellow-50 p-4">
              <p className="text-xs font-medium text-yellow-800 mb-2">보완하면 좋을 데이터</p>
              <ul className="text-xs text-yellow-700 space-y-1">
                {missingData.slice(0, 5).map((item, i) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            className="flex-1 gap-2"
            size="lg"
            onClick={() => router.push("/dashboard")}
          >
            대시보드로 이동 <ArrowRight className="h-4 w-4" />
          </Button>
          {profileScore < 80 && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push("/company")}
            >
              추가 인터뷰
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
