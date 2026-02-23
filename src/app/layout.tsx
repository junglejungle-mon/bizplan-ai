import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Script from "next/script";
import { UTMCapture } from "@/components/analytics/utm-capture";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bizplanai.co.kr";

export const metadata: Metadata = {
  title: "BizPlan AI — AI가 정부지원사업을 찾고 사업계획서까지 써주는 서비스",
  description:
    "정부지원사업 AI 매칭부터 사업계획서 자동 작성, IR PPT 생성까지. AI가 당신의 사업을 지원합니다.",
  keywords: [
    "정부지원사업",
    "사업계획서",
    "AI",
    "자동 작성",
    "중소기업",
    "스타트업",
    "IR PPT",
  ],
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "BizPlan AI — AI 사업계획서 자동 작성 서비스",
    description:
      "정부지원사업 AI 매칭 + 사업계획서 원스톱 자동 작성",
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: "BizPlan AI",
    // opengraph-image.tsx에서 자동 생성
  },
  twitter: {
    card: "summary_large_image",
    title: "BizPlan AI — AI 사업계획서 자동 작성 서비스",
    description: "정부지원사업 AI 매칭 + 사업계획서 원스톱 자동 작성",
    // opengraph-image.tsx에서 자동 생성
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "Tk_P-9n298nZG9EVERt9lMGDwpTnOBKPdUXG09psUXk",
    other: {
      "naver-site-verification": "4868b9dde52d56026369b6fed9f3b48fb7941c89",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="ko">
      <head>
        {/* Search Engine Verification - 직접 추가 (metadata.verification이 렌더되지 않는 이슈 해결) */}
        <meta name="google-site-verification" content="Tk_P-9n298nZG9EVERt9lMGDwpTnOBKPdUXG09psUXk" />
        <meta name="naver-site-verification" content="4868b9dde52d56026369b6fed9f3b48fb7941c89" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "BizPlan AI",
              url: siteUrl,
              description:
                "정부지원사업 AI 매칭부터 사업계획서 자동 작성, IR PPT 생성까지",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "KRW",
                description: "무료 체험 가능",
              },
              creator: {
                "@type": "Organization",
                name: "정글몬스터",
                url: "https://bizplanai.co.kr",
              },
            }),
          }}
        />
        {/* FAQPage Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "BizPlan AI는 무엇인가요?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "BizPlan AI는 AI 기술을 활용하여 정부지원사업 매칭, 사업계획서 자동 작성, IR PPT 생성을 제공하는 서비스입니다.",
                  },
                },
                {
                  "@type": "Question",
                  name: "사업계획서 자동 작성에 비용이 드나요?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "무료 체험 플랜으로 시작할 수 있으며, 프로 플랜은 월 99,000원, 올프리 플랜은 월 299,000원입니다.",
                  },
                },
                {
                  "@type": "Question",
                  name: "정부지원사업 매칭은 어떻게 작동하나요?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "회사 프로필과 업종, 지역, 직원수 등을 분석하여 296개 이상의 정부지원사업 중 적합한 사업을 AI가 자동으로 매칭해드립니다.",
                  },
                },
                {
                  "@type": "Question",
                  name: "HWPX(한글) 파일도 지원하나요?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "네, BizPlan AI는 HWPX, DOCX, PDF 형식의 사업계획서 출력을 지원하며, 정부기관 제출 양식에 맞춤 변환됩니다.",
                  },
                },
              ],
            }),
          }}
        />
        {/* BreadcrumbList Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "홈", item: siteUrl },
                { "@type": "ListItem", position: 2, name: "요금제", item: `${siteUrl}/pricing` },
                { "@type": "ListItem", position: 3, name: "자주 묻는 질문", item: `${siteUrl}/faq` },
                { "@type": "ListItem", position: 4, name: "문의하기", item: `${siteUrl}/contact` },
              ],
            }),
          }}
        />
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
            </Script>
          </>
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UTMCapture />
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
