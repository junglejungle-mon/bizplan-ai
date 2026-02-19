import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "요금제 - BizPlan AI",
  description:
    "BizPlan AI 요금제 안내. 무료 체험부터 프리미엄 플랜까지, AI 사업계획서 작성 서비스의 다양한 플랜을 확인하세요.",
  robots: { index: true, follow: true },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
