"use client";

import { useState } from "react";
import Link from "next/link";

const FAQ_DATA = [
  {
    category: "서비스 소개",
    items: [
      {
        q: "BizPlan AI는 어떤 서비스인가요?",
        a: "BizPlan AI는 AI를 활용하여 정부지원사업에 맞는 사업계획서를 자동으로 작성해주는 SaaS 서비스입니다. AI 인터뷰를 통해 기업 정보를 분석하고, 적합한 지원사업을 매칭한 후, 공고 양식에 맞춘 사업계획서를 자동 생성합니다.",
      },
      {
        q: "어떤 정부지원사업을 지원하나요?",
        a: "중소벤처기업부, K-Startup, 정부기업마당 등에 등록된 5,000개 이상의 정부지원사업 공고를 매칭합니다. 창업지원, R&D, 수출지원, 고용지원 등 다양한 분야를 포함합니다.",
      },
      {
        q: "AI가 작성한 사업계획서의 품질은 어떤가요?",
        a: "실제 선정된 사업계획서 패턴을 학습하여 작성하며, 100점 만점 품질 채점을 자동으로 진행합니다. 각 섹션별 작성 지침과 평가항목을 반영하여 실제 심사위원 관점에서 작성됩니다.",
      },
    ],
  },
  {
    category: "이용 방법",
    items: [
      {
        q: "어떻게 시작하나요?",
        a: "회원가입 후 AI 인터뷰(약 5~10분)를 진행합니다. 기업의 업종, 매출, 핵심 역량 등을 파악한 후 적합한 지원사업을 자동 매칭해드립니다. 원하는 공고를 선택하면 사업계획서가 자동 생성됩니다.",
      },
      {
        q: "사업계획서 생성에 얼마나 걸리나요?",
        a: "AI 인터뷰 완료 후 사업계획서 자동 생성은 약 3~5분 소요됩니다. 기존에 수일~수주가 걸리던 작업을 획기적으로 단축합니다.",
      },
      {
        q: "생성된 사업계획서를 수정할 수 있나요?",
        a: "네, 생성된 사업계획서의 각 섹션을 자유롭게 수정할 수 있으며, 특정 섹션만 AI로 재생성하는 것도 가능합니다. 최종본은 DOCX, PDF, HWP 형식으로 다운로드할 수 있습니다.",
      },
      {
        q: "IR(투자제안서) PPT도 만들 수 있나요?",
        a: "네, 사업계획서 기반으로 12슬라이드 구성의 IR PPT를 자동 생성합니다. 5가지 디자인 템플릿을 제공하며, PPTX 파일로 다운로드 가능합니다.",
      },
    ],
  },
  {
    category: "요금 및 결제",
    items: [
      {
        q: "무료로 이용할 수 있나요?",
        a: "무료 체험을 통해 AI 인터뷰, 프로그램 매칭, 사업계획서 1건 생성을 체험할 수 있습니다. 이후 월 구독을 통해 무제한 이용이 가능합니다.",
      },
      {
        q: "결제 수단은 무엇인가요?",
        a: "신용카드, 체크카드, 간편결제(카카오페이, 네이버페이 등)를 지원합니다.",
      },
      {
        q: "환불 정책은 어떻게 되나요?",
        a: "결제 후 7일 이내 미이용 시 전액 환불, 이용 시 부분 환불이 가능합니다. 설정 > 구독 관리에서 언제든지 해지할 수 있습니다.",
      },
    ],
  },
  {
    category: "계정 관리",
    items: [
      {
        q: "비밀번호를 잊어버렸어요.",
        a: "로그인 페이지에서 '비밀번호를 잊으셨나요?' 링크를 클릭하면 가입한 이메일로 비밀번호 재설정 링크를 보내드립니다.",
      },
      {
        q: "회원 탈퇴는 어떻게 하나요?",
        a: "설정 > 하단의 '회원 탈퇴' 버튼을 통해 탈퇴할 수 있습니다. 탈퇴 시 모든 데이터가 영구 삭제되며 복구가 불가능합니다.",
      },
    ],
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  const toggle = (key: string) => {
    setOpenIndex(openIndex === key ? null : key);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
              BP
            </div>
            <span className="font-semibold">
              BizPlan <span className="text-blue-600">AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/contact"
              className="text-sm text-gray-600 hover:text-blue-600"
            >
              문의하기
            </Link>
            <Link
              href="/login"
              className="text-sm text-blue-600 font-medium hover:underline"
            >
              로그인
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            자주 묻는 질문
          </h1>
          <p className="text-gray-500">
            궁금한 점이 있으신가요? 아래에서 답변을 찾아보세요.
          </p>
        </div>

        <div className="space-y-8">
          {FAQ_DATA.map((section) => (
            <div key={section.category}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {section.category}
              </h2>
              <div className="space-y-2">
                {section.items.map((item, idx) => {
                  const key = `${section.category}-${idx}`;
                  const isOpen = openIndex === key;
                  return (
                    <div
                      key={key}
                      className="bg-white rounded-lg border border-gray-200"
                    >
                      <button
                        onClick={() => toggle(key)}
                        className="w-full text-left px-5 py-4 flex items-center justify-between"
                      >
                        <span className="text-sm font-medium text-gray-800 pr-4">
                          {item.q}
                        </span>
                        <svg
                          className={`h-5 w-5 text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                          />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4">
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {item.a}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center bg-white rounded-xl border border-gray-200 p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            원하는 답변을 찾지 못하셨나요?
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            문의를 남겨주시면 빠르게 답변드리겠습니다.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            문의하기
          </Link>
        </div>
      </main>
    </div>
  );
}
