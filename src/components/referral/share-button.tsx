"use client";

import { useState } from "react";
import { Share2, Copy, Check, MessageCircle, Link2 } from "lucide-react";
import { buildReferralUTMLink } from "@/lib/utm";

interface ShareButtonProps {
  referralCode: string;
  referralLink: string;
}

export function ShareButton({ referralCode, referralLink }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const shareMessage = `🚀 AI로 사업계획서를 3분만에 만들어보세요!\n추천 코드: ${referralCode}\n지금 가입하면 사업계획서 1건 무료!`;

  const handleCopyLink = async () => {
    const utmLink = buildReferralUTMLink(referralCode, "copy");
    try {
      await navigator.clipboard.writeText(utmLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // 이벤트 로깅
      fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareType: "share_copy" }),
      }).catch(() => {});
    } catch {
      // 클립보드 실패 시 프롬프트
      window.prompt("링크를 복사하세요:", utmLink);
    }
    setShowMenu(false);
  };

  const handleShareKakao = () => {
    const kakaoUTMLink = buildReferralUTMLink(referralCode, "kakao");
    // 카카오 공유 (Kakao SDK)
    if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).Kakao) {
      const Kakao = (window as unknown as Record<string, unknown>).Kakao as {
        Share: {
          sendDefault: (params: Record<string, unknown>) => void;
        };
      };
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: "BizPlan AI - AI 사업계획서 자동 생성",
          description: "추천인 코드로 가입하면 사업계획서 1건 무료!",
          imageUrl: "https://bizplanai.co.kr/opengraph-image",
          link: {
            mobileWebUrl: kakaoUTMLink,
            webUrl: kakaoUTMLink,
          },
        },
        buttons: [
          {
            title: "무료로 시작하기",
            link: {
              mobileWebUrl: kakaoUTMLink,
              webUrl: kakaoUTMLink,
            },
          },
        ],
      });

      fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareType: "share_kakao" }),
      }).catch(() => {});
    } else {
      // 카카오 SDK 없으면 카카오톡 링크 열기
      const kakaoUrl = `https://story.kakao.com/share?url=${encodeURIComponent(kakaoUTMLink)}`;
      window.open(kakaoUrl, "_blank", "width=600,height=400");
    }
    setShowMenu(false);
  };

  const handleShareLink = async () => {
    const linkUTM = buildReferralUTMLink(referralCode, "link");
    if (navigator.share) {
      try {
        await navigator.share({
          title: "BizPlan AI - AI 사업계획서",
          text: shareMessage,
          url: linkUTM,
        });

        fetch("/api/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareType: "share_link" }),
        }).catch(() => {});
      } catch {
        // 사용자 취소
      }
    } else {
      handleCopyLink();
    }
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm"
      >
        <Share2 className="h-4 w-4" />
        친구 초대하기
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              onClick={handleShareKakao}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <MessageCircle className="h-4 w-4 text-yellow-500" />
              카카오톡으로 공유
            </button>
            <button
              onClick={handleShareLink}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Link2 className="h-4 w-4 text-blue-500" />
              링크 공유하기
            </button>
            <button
              onClick={handleCopyLink}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-gray-400" />
              )}
              {copied ? "복사 완료!" : "링크 복사"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
