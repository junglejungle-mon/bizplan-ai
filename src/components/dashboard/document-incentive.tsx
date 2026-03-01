"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileUp,
  CheckCircle2,
  Gift,
  ArrowRight,
  Sparkles,
  Trophy,
  Star,
  TrendingUp,
} from "lucide-react";

const DOCUMENT_TYPES = [
  { key: "business_registration", label: "사업자등록증", icon: "📋", boost: "+10%", priority: 1 },
  { key: "company_intro", label: "회사소개서", icon: "🏢", boost: "+20%", priority: 2 },
  { key: "financial_statement", label: "재무제표", icon: "💰", boost: "+25%", priority: 3 },
  { key: "patent_certificate", label: "특허증/인증서", icon: "📜", boost: "+20%", priority: 4 },
  { key: "tax_clearance", label: "국세완납증명서", icon: "🧾", boost: "+5%", priority: 5 },
  { key: "venture_certificate", label: "벤처확인서", icon: "🚀", boost: "+15%", priority: 6 },
];

// 레벨 시스템
function getLevel(count: number) {
  if (count === 0) return { name: "시작", emoji: "🌱", color: "gray", nextCount: 1, nextReward: "퀄리티 +15%" };
  if (count < 3) return { name: "기초", emoji: "📄", color: "orange", nextCount: 3, nextReward: "IR PPT 무료 🎁" };
  if (count < 5) return { name: "중급", emoji: "📊", color: "blue", nextCount: 5, nextReward: "프리미엄 퀄리티" };
  return { name: "프리미엄", emoji: "🏆", color: "green", nextCount: count, nextReward: "완성!" };
}

interface DocumentIncentiveProps {
  uploadedTypes: string[];
  profileScore: number;
}

export function DocumentIncentive({
  uploadedTypes,
}: DocumentIncentiveProps) {
  const uploadedCount = uploadedTypes.length;
  const level = getLevel(uploadedCount);
  const pptUnlocked = uploadedCount >= 3;
  const isPremium = uploadedCount >= 5;

  // 다음 목표까지 진행률
  const progressPercent = isPremium
    ? 100
    : Math.min(100, (uploadedCount / level.nextCount) * 100);

  // 미 업로드 서류 중 우선순위 순 정렬
  const missingDocs = DOCUMENT_TYPES
    .filter((doc) => !uploadedTypes.includes(doc.key))
    .sort((a, b) => a.priority - b.priority);

  // 다음 추천 서류
  const nextRecommended = missingDocs[0];

  return (
    <Card className={`overflow-hidden ${
      isPremium
        ? "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50"
        : pptUnlocked
          ? "border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50"
          : "border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50"
    }`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* 왼쪽: 레벨 표시 */}
          <div className="flex flex-col items-center gap-1">
            <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${
              isPremium ? "bg-green-100" : pptUnlocked ? "bg-blue-100" : "bg-orange-100"
            }`}>
              {isPremium ? (
                <Trophy className="h-7 w-7 text-green-600" />
              ) : pptUnlocked ? (
                <Star className="h-7 w-7 text-blue-600" />
              ) : (
                <FileUp className="h-7 w-7 text-orange-600" />
              )}
              {pptUnlocked && (
                <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            <span className="text-xs font-bold text-gray-500">
              {level.emoji} {level.name}
            </span>
            <div className="text-center">
              <span className={`text-lg font-bold ${
                isPremium ? "text-green-700" : pptUnlocked ? "text-blue-700" : "text-orange-700"
              }`}>
                {uploadedCount}
              </span>
              <span className="text-xs text-gray-400">/{level.nextCount}</span>
            </div>
          </div>

          {/* 오른쪽: 내용 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`text-sm font-bold ${
                isPremium ? "text-green-900" : pptUnlocked ? "text-blue-900" : "text-orange-900"
              }`}>
                {isPremium
                  ? "프리미엄 사업계획서 준비 완료!"
                  : pptUnlocked
                    ? "서류 업로드로 더 높은 품질!"
                    : "서류 업로드로 품질 UP!"}
              </h3>
              {isPremium ? (
                <Badge className="bg-green-100 text-green-700 text-[10px]">
                  <Trophy className="h-3 w-3 mr-0.5" />
                  프리미엄
                </Badge>
              ) : pptUnlocked ? (
                <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                  <Gift className="h-3 w-3 mr-0.5" />
                  PPT 무료 해금!
                </Badge>
              ) : (
                <Badge className="bg-orange-100 text-orange-700 text-[10px]">
                  {3 - uploadedCount}개 더 필요
                </Badge>
              )}
            </div>

            <p className="text-xs text-gray-600 mb-3">
              {isPremium
                ? "모든 서류가 반영된 최고 품질 사업계획서를 생성할 수 있어요!"
                : pptUnlocked
                  ? `서류를 ${5 - uploadedCount}개만 더 올려주시면 프리미엄 품질 사업계획서를 받을 수 있어요!`
                  : `서류를 ${3 - uploadedCount}개만 더 올려주시면 IR PPT를 무료로 만들어드려요! 📎`}
            </p>

            {/* 진행 바 */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  다음 목표: {level.nextReward}
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    isPremium
                      ? "bg-gradient-to-r from-green-400 to-emerald-600"
                      : pptUnlocked
                        ? "bg-gradient-to-r from-blue-400 to-indigo-600"
                        : "bg-gradient-to-r from-orange-400 to-orange-600"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 서류 체크리스트 - 모든 서류 표시 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {DOCUMENT_TYPES.map((doc) => {
                const isUploaded = uploadedTypes.includes(doc.key);
                return (
                  <div
                    key={doc.key}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] transition-all ${
                      isUploaded
                        ? "bg-green-100 text-green-700 ring-1 ring-green-200"
                        : "bg-white/70 text-gray-500 border border-gray-200 hover:border-orange-300 hover:bg-orange-50"
                    }`}
                  >
                    {isUploaded ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <span>{doc.icon}</span>
                    )}
                    <span>{doc.label}</span>
                    {!isUploaded && (
                      <span className="text-orange-500 font-medium">{doc.boost}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 다음 추천 서류 하이라이트 */}
            {nextRecommended && !isPremium && (
              <div className={`flex items-center gap-2 mb-3 p-2 rounded-lg ${
                pptUnlocked ? "bg-blue-50 border border-blue-100" : "bg-orange-50 border border-orange-100"
              }`}>
                <Sparkles className={`h-4 w-4 ${pptUnlocked ? "text-blue-500" : "text-orange-500"}`} />
                <span className="text-xs text-gray-700">
                  <strong>{nextRecommended.label}</strong> 올려주시면 퀄리티가 <strong className={pptUnlocked ? "text-blue-600" : "text-orange-600"}>{nextRecommended.boost}</strong> 올라가요!
                </span>
              </div>
            )}

            <Link href="/documents">
              <Button
                size="sm"
                className={`gap-2 ${
                  isPremium
                    ? "bg-green-600 hover:bg-green-700"
                    : pptUnlocked
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-orange-600 hover:bg-orange-700"
                } text-white`}
              >
                <Sparkles className="h-3 w-3" />
                {isPremium ? "서류 관리하기" : "서류 올리러 가기"}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
