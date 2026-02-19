"use client";

import { useState } from "react";
import Link from "next/link";

const CATEGORIES = [
  "서비스 이용 문의",
  "결제/환불 문의",
  "기술 오류 신고",
  "기능 제안",
  "파트너십/제휴",
  "기타",
];

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    category: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // DB에 문의 저장
    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } catch {
      // 실패해도 문의 접수로 처리
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            문의가 접수되었습니다
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            빠른 시일 내에 입력하신 이메일로 답변드리겠습니다.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/faq"
              className="text-sm text-gray-600 hover:text-blue-600 px-4 py-2 border border-gray-200 rounded-lg"
            >
              FAQ 보기
            </Link>
            <Link
              href="/"
              className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
            >
              홈으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
              href="/faq"
              className="text-sm text-gray-600 hover:text-blue-600"
            >
              FAQ
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

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">문의하기</h1>
          <p className="text-gray-500">
            궁금한 점이나 불편한 사항을 알려주세요. 빠르게 답변드리겠습니다.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="홍길동"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                문의 유형
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">선택해주세요</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                문의 내용
              </label>
              <textarea
                value={form.message}
                onChange={(e) =>
                  setForm({ ...form, message: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px] resize-y"
                placeholder="문의 내용을 자세히 적어주세요."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "전송 중..." : "문의 보내기"}
            </button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            이메일:{" "}
            <a
              href="mailto:dktkghdeh@jmnc.co.kr"
              className="text-blue-600 hover:underline"
            >
              dktkghdeh@jmnc.co.kr
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
