import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "문의하기 — BizPlan AI",
  description:
    "BizPlan AI 서비스 이용 관련 문의, 제휴 제안, 기술 지원 요청을 받고 있습니다.",
  openGraph: {
    title: "문의하기 — BizPlan AI",
    description:
      "BizPlan AI 서비스 이용 관련 문의, 제휴 제안, 기술 지원 요청을 받고 있습니다.",
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
