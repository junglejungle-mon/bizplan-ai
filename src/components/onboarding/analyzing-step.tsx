"use client";

import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";

interface AnalyzingStepProps {
  progress: number;
  step: string;
}

export function AnalyzingStep({ progress, step }: AnalyzingStepProps) {
  const stages = [
    { label: "인사이트 추출", threshold: 10 },
    { label: "사업 프로필 구축", threshold: 50 },
    { label: "데이터 저장", threshold: 80 },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <Card className="w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 mb-6">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">사업 프로필 분석 중</h1>
          <p className="mt-2 text-gray-500">
            AI가 인터뷰 데이터를 분석하여 사업 프로필을 구축하고 있습니다
          </p>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">{step || "준비 중..."}</span>
            <span className="font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="h-3 rounded-full bg-gray-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-3 mt-6">
          {stages.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                progress >= item.threshold + 40
                  ? "bg-green-100 text-green-600"
                  : progress >= item.threshold
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-400"
              }`}>
                {progress >= item.threshold + 40 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : progress >= item.threshold ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span className={`text-sm ${
                progress >= item.threshold
                  ? "text-gray-900 font-medium"
                  : "text-gray-400"
              }`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-gray-400 text-center">
          약 30~60초 소요됩니다. 잠시만 기다려 주세요.
        </p>
      </Card>
    </div>
  );
}
