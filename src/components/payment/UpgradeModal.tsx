"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** 초과된 기능명 */
  featureName: string;
  /** 현재 사용량 */
  current: number;
  /** 한도 */
  limit: number;
  /** 추천 플랜 */
  recommendedPlan?: string;
}

/**
 * 무료 플랜 한도 초과 시 업그레이드 유도 모달
 * - 현재 사용량 시각화
 * - 유료 플랜 혜택 요약
 * - CTA: 요금제 페이지 / 14일 무료 체험
 */
export function UpgradeModal({
  open,
  onClose,
  featureName,
  current,
  limit,
  recommendedPlan = "Pro",
}: UpgradeModalProps) {
  const [closing, setClosing] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  };

  const UPGRADE_BENEFITS = [
    { icon: "📝", text: "사업계획서 월 10건 생성", highlight: true },
    { icon: "🎯", text: "AI 섹션 재생성 50회" },
    { icon: "📊", text: "IR PPT 생성 5건" },
    { icon: "📥", text: "다운로드 20건" },
    { icon: "🤖", text: "AI 컨설턴트 무제한" },
    { icon: "⚡", text: "우선 처리 & 전담 지원" },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        closing ? "animate-fadeOut" : "animate-fadeIn"
      }`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="업그레이드 안내"
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 모달 본체 */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ${
          closing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        } transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 그라데이션 배너 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white text-center">
          <div className="text-4xl mb-3">🚀</div>
          <h2 className="text-xl font-bold mb-2">
            {featureName} 한도에 도달했습니다
          </h2>
          <p className="text-blue-100 text-sm">
            이번 달 {limit}건 중 {current}건을 사용했습니다
          </p>

          {/* 사용량 바 */}
          <div className="mt-4 w-full bg-blue-800/50 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-white transition-all"
              style={{ width: "100%" }}
            />
          </div>
          <p className="text-xs text-blue-200 mt-1">
            {current}/{limit} 사용 완료
          </p>
        </div>

        {/* 혜택 목록 */}
        <div className="px-6 py-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">
            {recommendedPlan} 플랜으로 업그레이드하면:
          </p>
          <div className="space-y-2">
            {UPGRADE_BENEFITS.map((benefit) => (
              <div key={benefit.text} className="flex items-center gap-2">
                <span className="text-base">{benefit.icon}</span>
                <span
                  className={`text-sm ${
                    benefit.highlight
                      ? "text-blue-700 font-medium"
                      : "text-gray-600"
                  }`}
                >
                  {benefit.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA 버튼 */}
        <div className="px-6 pb-6 space-y-2">
          <Link href="/pricing" className="block">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium">
              요금제 보기
            </Button>
          </Link>
          <button
            onClick={handleClose}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 사용량 경고 배너 (한도 80% 도달 시 표시)
 */
export function UsageWarningBanner({
  featureName,
  current,
  limit,
  onDismiss,
}: {
  featureName: string;
  current: number;
  limit: number;
  onDismiss: () => void;
}) {
  const percentage = Math.round((current / limit) * 100);

  if (percentage < 80 || limit === -1) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-amber-500">⚠️</span>
        <p className="text-sm text-amber-800">
          <span className="font-medium">{featureName}</span> 사용량이{" "}
          <span className="font-bold">{percentage}%</span>에 도달했습니다.{" "}
          <Link
            href="/pricing"
            className="text-blue-600 hover:underline font-medium"
          >
            업그레이드
          </Link>
          하면 더 많이 사용할 수 있어요.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-amber-400 hover:text-amber-600 ml-2"
        aria-label="경고 닫기"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
