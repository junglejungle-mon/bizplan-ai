import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "자주 묻는 질문 (FAQ) — BizPlan AI",
  description:
    "BizPlan AI 서비스 이용, 결제, 사업계획서 작성, 정부지원사업 매칭에 대한 자주 묻는 질문과 답변입니다.",
  openGraph: {
    title: "자주 묻는 질문 (FAQ) — BizPlan AI",
    description:
      "서비스 이용, 결제, 사업계획서 작성에 대한 자주 묻는 질문과 답변입니다.",
  },
};

export default function FaqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
