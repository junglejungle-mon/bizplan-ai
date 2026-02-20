import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인 | BizPlan AI",
  description:
    "BizPlan AI에 로그인하여 AI 기반 사업계획서 작성, 정부지원사업 매칭 서비스를 이용하세요.",
  robots: { index: true, follow: true },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
