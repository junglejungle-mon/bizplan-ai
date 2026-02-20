"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Target,
  Search,
  FileText,
  FolderOpen,
  ArrowRight,
  Flame,
  Lightbulb,
  CheckSquare,
  CalendarDays,
  Send,
  Loader2,
  Bot,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

interface Mission {
  id: string;
  type: "urgent" | "profile" | "document" | "plan" | "program";
  title: string;
  description: string;
  href: string;
  cta: string;
  priority: number;
}

interface MatchedProgram {
  id: string;
  title: string;
  institution: string;
  source: string;
  applyEnd: string;
  matchScore: number | null;
  fitLevel: string | null;
  hashtags?: string[];
  dDay: number;
}

interface WeekEvent {
  date: string;
  title: string;
  score: number | null;
}

interface DashboardClientProps {
  companyName: string;
  profileScore: number;
  matchCount: number;
  planCount: number;
  docCount: number;
  programCount: number;
  deadlineSoonCount: number;
  missions: Mission[];
  aiComment: string;
  urgentPrograms: MatchedProgram[];
  topMatchings: MatchedProgram[];
  weekDays: string[];
  weekEvents: WeekEvent[];
  extractedDocTypes: string[];
}

const MISSION_STYLES: Record<
  string,
  { icon: typeof Target; bg: string; text: string; border: string; badge: string }
> = {
  urgent: {
    icon: Flame,
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
  },
  profile: {
    icon: Target,
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
  },
  document: {
    icon: FolderOpen,
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-700",
  },
  plan: {
    icon: FileText,
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    badge: "bg-purple-100 text-purple-700",
  },
  program: {
    icon: Search,
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    badge: "bg-green-100 text-green-700",
  },
};

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export function DashboardClient({
  companyName,
  profileScore,
  matchCount,
  planCount,
  docCount,
  programCount,
  deadlineSoonCount,
  missions,
  aiComment,
  urgentPrograms,
  topMatchings,
  weekDays,
  weekEvents,
}: DashboardClientProps) {
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [streamingText, setStreamingText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, streamingText]);

  const handleChat = async (prompt?: string) => {
    const text = prompt || chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setChatLoading(true);
    setStreamingText("");

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) throw new Error("Chat error");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.type === "chunk") {
              fullText += d.text;
              setStreamingText(fullText);
            } else if (d.type === "done") {
              setChatMessages((prev) => [
                ...prev,
                { role: "assistant", content: d.fullText || fullText },
              ]);
              setStreamingText("");
            }
          } catch {}
        }
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "죄송합니다, 오류가 발생했습니다." },
      ]);
    }
    setChatLoading(false);
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const profileTarget = 70;

  return (
    <div className="space-y-6">
      {/* 헤더: 오늘의 현황 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {companyName}의 오늘
          </h1>
          <p className="mt-1 text-sm text-gray-500">{dateStr}</p>
        </div>
      </div>

      {/* 프로필 진행바 */}
      <Card className="border-0 bg-gradient-to-r from-slate-50 to-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">
                프로필 완성도
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-blue-600">
                {profileScore}%
              </span>
              {profileScore < profileTarget && (
                <span className="text-xs text-gray-400">
                  → {profileTarget}% 달성 시 AI 계획서 해금
                </span>
              )}
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-gray-200">
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
              style={{ width: `${profileScore}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 3 카드: 긴급 / 추천 / 팁 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 긴급 */}
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                <Flame className="h-4 w-4 text-red-600" />
              </div>
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                긴급
              </span>
            </div>
            {urgentPrograms.length > 0 ? (
              <>
                <p className="text-2xl font-bold text-red-700">
                  D-{urgentPrograms[0].dDay}
                </p>
                <p className="text-xs text-red-600 mt-1 line-clamp-1">
                  {urgentPrograms[0].title}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-green-500">✓</p>
                <p className="text-xs text-gray-400 mt-1">7일 내 마감 없음</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 추천 */}
        <Link href="/programs">
          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                  <Search className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">
                  매칭 사업
                </span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {matchCount}건
              </p>
              <p className="text-xs text-green-600 mt-1">
                {deadlineSoonCount > 0
                  ? `${deadlineSoonCount}건 30일 내 마감`
                  : "맞춤 지원사업 확인"}
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* 팁 */}
        <Link href="/documents">
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                  <Lightbulb className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                  팁
                </span>
              </div>
              <p className="text-2xl font-bold text-purple-700">
                {docCount < 3 ? `${3 - docCount}개` : "완료"}
              </p>
              <p className="text-xs text-purple-600 mt-1">
                {docCount < 3
                  ? "서류 올리면 IR PPT 무료"
                  : "서류 연동 완료!"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* 오늘의 미션 */}
      {missions.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckSquare className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-gray-900">
                오늘의 미션
              </h2>
              <Badge className="bg-indigo-100 text-indigo-700 text-[10px]">
                {missions.length}개
              </Badge>
            </div>
            <div className="space-y-3">
              {missions.map((mission) => {
                const style = MISSION_STYLES[mission.type] || MISSION_STYLES.program;
                const Icon = style.icon;
                return (
                  <Link key={mission.id} href={mission.href}>
                    <div
                      className={`flex items-center gap-4 p-3 rounded-xl border ${style.border} ${style.bg} hover:shadow-sm transition-all cursor-pointer group`}
                    >
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${style.badge}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {mission.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {mission.description}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`shrink-0 gap-1 ${style.text} group-hover:bg-white/50`}
                      >
                        {mission.cta}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 중단: AI 컨설턴트 + 내 현황 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* AI 컨설턴트 (3/5) */}
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  AI 컨설턴트
                </h2>
              </div>
            </div>

            {/* AI 코멘트 */}
            <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-3 mb-4">
              <p className="text-sm text-indigo-800">{aiComment}</p>
            </div>

            {/* 채팅 영역 */}
            <div className="h-48 overflow-y-auto space-y-2 mb-3">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-xl px-3 py-2 text-sm bg-gray-100 text-gray-800">
                    {streamingText}
                  </div>
                </div>
              )}
              {chatLoading && !streamingText && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-3 py-2 bg-gray-100">
                    <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* 빠른 질문 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                "마감 임박 사업",
                "맞춤 전략 상담",
                "프로필 개선 팁",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => handleChat(q)}
                  disabled={chatLoading}
                  className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-indigo-100 text-xs text-gray-600 hover:text-indigo-700 transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* 입력 */}
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="질문을 입력하세요..."
                aria-label="AI에게 질문"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChat();
                  }
                }}
                disabled={chatLoading}
              />
              <Button
                size="icon"
                onClick={() => handleChat()}
                disabled={chatLoading || !chatInput.trim()}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 내 현황 요약 (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                내 현황
              </h3>
              <div className="space-y-3">
                {[
                  {
                    label: "매칭 지원사업",
                    value: `${matchCount}건`,
                    icon: Search,
                    color: "text-green-600",
                    bg: "bg-green-50",
                    href: "/programs",
                  },
                  {
                    label: "작성 계획서",
                    value: `${planCount}건`,
                    icon: FileText,
                    color: "text-purple-600",
                    bg: "bg-purple-50",
                    href: "/plans",
                  },
                  {
                    label: "연동 서류",
                    value: `${docCount}건`,
                    icon: FolderOpen,
                    color: "text-orange-600",
                    bg: "bg-orange-50",
                    href: "/documents",
                  },
                  {
                    label: "프로필 점수",
                    value: `${profileScore}%`,
                    icon: Target,
                    color: "text-blue-600",
                    bg: "bg-blue-50",
                    href: "/company",
                  },
                ].map((item) => (
                  <Link key={item.label} href={item.href}>
                    <div className="flex items-center justify-between py-2 px-1 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-lg ${item.bg}`}
                        >
                          <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                        </div>
                        <span className="text-sm text-gray-600">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {item.value}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 수집 현황 배지 */}
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-gray-400">
              총 {programCount.toLocaleString()}건 지원사업 수집
            </span>
            <Link
              href="/programs"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              전체 보기 →
            </Link>
          </div>
        </div>
      </div>

      {/* 마감 임박 + 이번주 캘린더 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* 마감 임박 매칭 사업 (3/5) */}
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h2 className="text-base font-bold text-gray-900">
                  맞춤 지원사업 TOP 5
                </h2>
              </div>
              <Link
                href="/programs"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                전체 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {topMatchings.length > 0 ? (
              <div className="space-y-2">
                {topMatchings.map((prog, i) => (
                  <Link key={prog.id} href={`/programs/${prog.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                          i === 0
                            ? "bg-yellow-100 text-yellow-700"
                            : i === 1
                            ? "bg-gray-100 text-gray-600"
                            : "bg-orange-50 text-orange-600"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">
                          {prog.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">
                            {prog.institution}
                          </span>
                          {prog.dDay > 0 && prog.dDay <= 30 && (
                            <Badge
                              className={`text-[9px] px-1.5 py-0 ${
                                prog.dDay <= 3
                                  ? "bg-red-100 text-red-700"
                                  : prog.dDay <= 7
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              D-{prog.dDay}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-bold ${
                            (prog.matchScore || 0) >= 80
                              ? "text-green-600"
                              : (prog.matchScore || 0) >= 60
                              ? "text-blue-600"
                              : "text-gray-500"
                          }`}
                        >
                          {prog.matchScore || "-"}점
                        </p>
                        {prog.fitLevel && (
                          <span className="text-[9px] text-gray-400">
                            {prog.fitLevel}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  {matchCount === 0
                    ? "AI 인터뷰를 완료하면 맞춤 사업이 매칭돼요"
                    : "매칭 사업을 확인해보세요"}
                </p>
                <Link href={matchCount === 0 ? "/onboarding" : "/programs"}>
                  <Button size="sm" variant="outline" className="mt-3 gap-1">
                    {matchCount === 0 ? "인터뷰 시작" : "지원사업 보기"}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 이번 주 미니 캘린더 (2/5) */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-gray-900">이번 주 마감</h3>
              </div>
              <Link
                href="/scheduler"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                캘린더 →
              </Link>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-3">
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-[10px] font-medium text-gray-400 py-1"
                >
                  {label}
                </div>
              ))}
              {weekDays.map((dayStr, i) => {
                const d = new Date(dayStr);
                const dayNum = d.getDate();
                const isToday = d.toDateString() === today.toDateString();
                const dayEvents = weekEvents.filter(
                  (e) =>
                    new Date(e.date).toDateString() === d.toDateString()
                );
                const hasEvent = dayEvents.length > 0;

                return (
                  <div
                    key={i}
                    className={`text-center py-2 rounded-lg relative ${
                      isToday
                        ? "bg-indigo-600 text-white font-bold"
                        : hasEvent
                        ? "bg-red-50 text-red-700 font-medium"
                        : "text-gray-600"
                    }`}
                  >
                    <span className="text-xs">{dayNum}</span>
                    {hasEvent && (
                      <div
                        className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full ${
                          isToday ? "bg-white" : "bg-red-500"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* 이번 주 이벤트 리스트 */}
            {weekEvents.length > 0 ? (
              <div className="space-y-1.5">
                {weekEvents.slice(0, 3).map((ev, i) => {
                  const evDate = new Date(ev.date);
                  const evDDay = Math.ceil(
                    (evDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Badge
                        className={`text-[9px] px-1.5 py-0 shrink-0 ${
                          evDDay <= 3
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        D-{Math.max(0, evDDay)}
                      </Badge>
                      <span className="text-gray-700 line-clamp-1">
                        {ev.title.length > 18
                          ? ev.title.substring(0, 18) + "..."
                          : ev.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">
                이번 주 마감 사업 없음
              </p>
            )}

            <Link href="/scheduler">
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3 gap-1 text-xs"
              >
                <CalendarDays className="h-3 w-3" />
                전체 스케줄 보기
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
