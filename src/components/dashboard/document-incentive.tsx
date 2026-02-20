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
} from "lucide-react";

const DOCUMENT_TYPES = [
  { key: "business_registration", label: "사업자등록증", icon: "📋" },
  { key: "company_intro", label: "회사소개서", icon: "🏢" },
  { key: "financial_statement", label: "재무제표", icon: "💰" },
  { key: "patent_certificate", label: "특허증/인증서", icon: "📜" },
  { key: "tax_clearance", label: "국세완납증명서", icon: "🧾" },
  { key: "venture_certificate", label: "벤처확인서", icon: "🚀" },
];

interface DocumentIncentiveProps {
  uploadedTypes: string[];
  profileScore: number;
}

export function DocumentIncentive({
  uploadedTypes,
}: DocumentIncentiveProps) {
  const uploadedCount = uploadedTypes.length;
  const pptUnlocked = uploadedCount >= 3;
  const progressPercent = Math.min(100, (uploadedCount / 3) * 100);

  return (
    <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* 왼쪽: 아이콘 + 진행률 */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100">
              <FileUp className="h-7 w-7 text-orange-600" />
              {pptUnlocked && (
                <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            <div className="text-center">
              <span className="text-lg font-bold text-orange-700">
                {uploadedCount}
              </span>
              <span className="text-xs text-orange-500">/3</span>
            </div>
          </div>

          {/* 오른쪽: 내용 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-orange-900">
                서류 업로드로 품질 UP!
              </h3>
              {pptUnlocked ? (
                <Badge className="bg-green-100 text-green-700 text-[10px]">
                  <Gift className="h-3 w-3 mr-0.5" />
                  PPT 무료 해금!
                </Badge>
              ) : (
                <Badge className="bg-orange-100 text-orange-700 text-[10px]">
                  {3 - uploadedCount}개 더 필요
                </Badge>
              )}
            </div>

            <p className="text-xs text-orange-700 mb-3">
              {pptUnlocked
                ? "축하해요! IR PPT 무료 생성이 가능합니다. 서류가 많을수록 계획서 품질이 올라가요!"
                : `서류를 ${3 - uploadedCount}개만 더 올려주시면 IR PPT를 무료로 만들어드려요! 📎`}
            </p>

            {/* 진행 바 */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] text-orange-600 mb-1">
                <span>서류 업로드 진행률</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-2 rounded-full bg-orange-100">
                <div
                  className={`h-2 rounded-full transition-all ${
                    pptUnlocked
                      ? "bg-gradient-to-r from-green-400 to-green-600"
                      : "bg-gradient-to-r from-orange-400 to-orange-600"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 서류 체크리스트 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {DOCUMENT_TYPES.slice(0, 4).map((doc) => {
                const isUploaded = uploadedTypes.includes(doc.key);
                return (
                  <div
                    key={doc.key}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] ${
                      isUploaded
                        ? "bg-green-100 text-green-700"
                        : "bg-white/70 text-gray-500 border border-orange-200"
                    }`}
                  >
                    {isUploaded ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <span>{doc.icon}</span>
                    )}
                    <span>{doc.label}</span>
                  </div>
                );
              })}
            </div>

            <Link href="/documents">
              <Button
                size="sm"
                className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Sparkles className="h-3 w-3" />
                서류 올리러 가기
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
