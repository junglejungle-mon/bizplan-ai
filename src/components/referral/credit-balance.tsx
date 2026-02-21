"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";

interface CreditBalanceProps {
  creditsAvailable: number;
  /** 컴팩트 모드 (사이드바/헤더용) */
  compact?: boolean;
}

export function CreditBalance({ creditsAvailable, compact = false }: CreditBalanceProps) {
  if (compact) {
    if (creditsAvailable <= 0) return null;

    return (
      <Link
        href="/dashboard/referral"
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-50 to-blue-50 px-3 py-1 text-xs font-medium text-purple-700 hover:from-purple-100 hover:to-blue-100 transition-colors border border-purple-100"
      >
        <Sparkles className="h-3 w-3" />
        무료 {creditsAvailable}건
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-500">추천 보너스 크레딧</h3>
          <p className="mt-2 text-3xl font-bold text-purple-700">
            {creditsAvailable}
            <span className="text-lg font-normal text-purple-400">건</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            사업계획서 생성 시 자동으로 차감됩니다
          </p>
        </div>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100">
          <Sparkles className="h-7 w-7 text-purple-600" />
        </div>
      </div>
    </div>
  );
}
