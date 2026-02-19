import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://bizplan-ai.vercel.app";

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
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BizPlan AI — AI 사업계획서 자동 작성 서비스",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BizPlan AI — AI 사업계획서 자동 작성 서비스",
    description: "정부지원사업 AI 매칭 + 사업계획서 원스톱 자동 작성",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
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
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
