"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";

interface TermsStepProps {
  onAgree: () => void;
  loading?: boolean;
}

export function TermsStep({ onAgree, loading }: TermsStepProps) {
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 mb-3">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>서비스 이용 동의</CardTitle>
          <CardDescription>
            BizPlan AI 서비스를 이용하려면 아래 약관에 동의해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={agreeTerms && agreePrivacy}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  setAgreePrivacy(e.target.checked);
                }}
                aria-label="전체 약관 동의"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-900">
                전체 동의
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-2 pl-6">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                aria-label="이용약관 동의"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                <Link href="/terms" target="_blank" className="text-blue-600 hover:underline font-medium">
                  [필수] 이용약관
                </Link>
                에 동의합니다
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-2 pl-6">
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                aria-label="개인정보처리방침 동의"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                <Link href="/privacy" target="_blank" className="text-blue-600 hover:underline font-medium">
                  [필수] 개인정보처리방침
                </Link>
                에 동의합니다
              </span>
            </label>
          </div>

          <Button
            className="w-full"
            disabled={!agreeTerms || !agreePrivacy || loading}
            onClick={onAgree}
          >
            {loading ? "처리 중..." : "동의하고 시작하기"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
