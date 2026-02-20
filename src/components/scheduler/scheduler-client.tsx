"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Star,
  Search,
  Building2,
  ArrowRight,
  Target,
  Bell,
  ListFilter,
  CalendarClock,
} from "lucide-react";

interface CalendarEvent {
  id: string;
  programId: string;
  title: string;
  institution: string;
  source: string;
  applyStart: string | null;
  applyEnd: string | null;
  hashtags: string[];
  matchScore: number | null;
  fitLevel: string | null;
  matchReason: string | null;
  status: string;
  isMatched: boolean;
  detailUrl: string | null;
}

interface SchedulerClientProps {
  events: CalendarEvent[];
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];

const SOURCE_LABELS: Record<string, string> = {
  bizinfo: "기업마당",
  mss: "중소벤처",
  kstartup: "K-Startup",
};

const FIT_COLORS: Record<string, string> = {
  매우적합: "bg-green-100 text-green-700 border-green-200",
  적합: "bg-blue-100 text-blue-700 border-blue-200",
  보통: "bg-yellow-100 text-yellow-700 border-yellow-200",
  부적합: "bg-gray-100 text-gray-500 border-gray-200",
};

function getDday(dateStr: string): number {
  const end = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getDdayLabel(dday: number): string {
  if (dday < 0) return "마감";
  if (dday === 0) return "D-Day";
  return `D-${dday}`;
}

function getDdayColor(dday: number): string {
  if (dday < 0) return "bg-gray-100 text-gray-500";
  if (dday === 0) return "bg-red-100 text-red-700 animate-pulse";
  if (dday <= 3) return "bg-red-100 text-red-600";
  if (dday <= 7) return "bg-orange-100 text-orange-600";
  if (dday <= 14) return "bg-yellow-100 text-yellow-600";
  return "bg-blue-100 text-blue-600";
}

export function SchedulerClient({ events }: SchedulerClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [filterMatched, setFilterMatched] = useState<"all" | "matched">("all");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 월 이동
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };
  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  // 필터된 이벤트
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterMatched === "matched" && !e.isMatched) return false;
      return true;
    });
  }, [events, filterMatched]);

  // 날짜별 이벤트 맵 (마감일 기준)
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach((e) => {
      if (!e.applyEnd) return;
      const dateKey = e.applyEnd.split("T")[0];
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(e);
    });
    return map;
  }, [filteredEvents]);

  // 캘린더 그리드 생성
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];

    // 빈 칸
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // 날짜
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [year, month]);

  // 선택 날짜 이벤트
  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  // 마감 임박 이벤트 (7일 이내)
  const urgentEvents = useMemo(() => {
    return filteredEvents
      .filter((e) => {
        if (!e.applyEnd) return false;
        const dday = getDday(e.applyEnd);
        return dday >= 0 && dday <= 7;
      })
      .sort((a, b) => {
        const da = getDday(a.applyEnd!);
        const db = getDday(b.applyEnd!);
        return da - db;
      });
  }, [filteredEvents]);

  // 이번달 이벤트 리스트 (리스트뷰용)
  const monthEvents = useMemo(() => {
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    return filteredEvents
      .filter(
        (e) => e.applyEnd && e.applyEnd.startsWith(monthStr)
      )
      .sort(
        (a, b) =>
          new Date(a.applyEnd!).getTime() - new Date(b.applyEnd!).getTime()
      );
  }, [filteredEvents, year, month]);

  // 통계
  const stats = useMemo(() => {
    const matched = events.filter((e) => e.isMatched).length;
    const upcoming = events.filter(
      (e) => e.applyEnd && getDday(e.applyEnd) >= 0 && getDday(e.applyEnd) <= 30
    ).length;
    const urgent = urgentEvents.length;
    return { matched, upcoming, urgent, total: events.length };
  }, [events, urgentEvents]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-blue-600" />
            지원 스케줄러
          </h1>
          <p className="mt-1 text-gray-500 text-sm">
            지원사업 마감일과 일정을 한눈에 관리하세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filterMatched === "all" ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setFilterMatched("all")}
          >
            전체 ({stats.total})
          </Button>
          <Button
            variant={filterMatched === "matched" ? "default" : "outline"}
            size="sm"
            className="text-xs gap-1"
            onClick={() => setFilterMatched("matched")}
          >
            <Star className="h-3 w-3" />
            매칭 ({stats.matched})
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "매칭 사업",
            value: stats.matched,
            icon: Star,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "30일 내 마감",
            value: stats.upcoming,
            icon: CalendarClock,
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "7일 내 마감",
            value: stats.urgent,
            icon: AlertTriangle,
            color: "text-orange-600",
            bg: "bg-orange-50",
          },
          {
            label: "전체 수집",
            value: stats.total,
            icon: Search,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i}>
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}
                >
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 마감 임박 배너 */}
      {urgentEvents.length > 0 && (
        <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-800">
                마감 임박! ({urgentEvents.length}건)
              </span>
            </div>
            <div className="space-y-2">
              {urgentEvents.slice(0, 5).map((e) => {
                const dday = getDday(e.applyEnd!);
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        className={`text-[10px] shrink-0 ${getDdayColor(dday)}`}
                      >
                        {getDdayLabel(dday)}
                      </Badge>
                      <span className="text-xs font-medium text-gray-800 truncate">
                        {e.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {e.matchScore && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-blue-200 text-blue-600"
                        >
                          {e.matchScore}점
                        </Badge>
                      )}
                      <Link
                        href={`/programs/${e.programId}`}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 빈 상태 */}
      {events.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <CalendarDays className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium mb-2">
              아직 매칭된 지원사업이 없습니다
            </p>
            <p className="text-sm text-gray-400 mb-4">
              AI 인터뷰를 완료하면 맞춤 지원사업을 자동으로 매칭해드립니다
            </p>
            <Link href="/programs">
              <Button className="gap-2">
                <Search className="h-4 w-4" />
                지원사업 둘러보기
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {events.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 캘린더 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={prevMonth}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </button>
                    <CardTitle className="text-lg">
                      {year}년 {MONTHS[month]}
                    </CardTitle>
                    <button
                      onClick={nextMonth}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <ChevronRight className="h-5 w-5 text-gray-600" />
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-gray-500"
                      onClick={goToday}
                    >
                      오늘
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={viewMode === "calendar" ? "default" : "ghost"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setViewMode("calendar")}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setViewMode("list")}
                    >
                      <ListFilter className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {viewMode === "calendar" ? (
                  <>
                    {/* 요일 헤더 */}
                    <div className="grid grid-cols-7 gap-px mb-1">
                      {WEEKDAYS.map((day, i) => (
                        <div
                          key={day}
                          className={`text-center text-xs font-medium py-2 ${
                            i === 0
                              ? "text-red-400"
                              : i === 6
                              ? "text-blue-400"
                              : "text-gray-400"
                          }`}
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* 날짜 그리드 */}
                    <div className="grid grid-cols-7 gap-px">
                      {calendarDays.map((day, i) => {
                        if (day === null) {
                          return (
                            <div key={`empty-${i}`} className="h-20 bg-gray-50 rounded" />
                          );
                        }

                        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const dayEvents = eventsByDate[dateStr] || [];
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === selectedDate;
                        const dayOfWeek = new Date(year, month, day).getDay();
                        const matchedCount = dayEvents.filter(
                          (e) => e.isMatched
                        ).length;
                        const unmatchedCount = dayEvents.length - matchedCount;

                        return (
                          <button
                            key={dateStr}
                            onClick={() =>
                              setSelectedDate(
                                isSelected ? null : dateStr
                              )
                            }
                            className={`h-20 rounded-lg border text-left p-1 transition-all ${
                              isSelected
                                ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400"
                                : isToday
                                ? "border-blue-200 bg-blue-50/50"
                                : "border-gray-100 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <span
                              className={`text-xs font-medium ${
                                isToday
                                  ? "text-blue-600 font-bold"
                                  : dayOfWeek === 0
                                  ? "text-red-400"
                                  : dayOfWeek === 6
                                  ? "text-blue-400"
                                  : "text-gray-700"
                              }`}
                            >
                              {day}
                            </span>
                            {dayEvents.length > 0 && (
                              <div className="mt-0.5 space-y-0.5">
                                {matchedCount > 0 && (
                                  <div className="flex items-center gap-0.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                    <span className="text-[9px] text-blue-600 font-medium truncate">
                                      매칭 {matchedCount}
                                    </span>
                                  </div>
                                )}
                                {unmatchedCount > 0 && (
                                  <div className="flex items-center gap-0.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                    <span className="text-[9px] text-gray-500 truncate">
                                      기타 {unmatchedCount}
                                    </span>
                                  </div>
                                )}
                                {dayEvents.length > 0 && (
                                  <div className="text-[8px] text-gray-400 truncate">
                                    {dayEvents[0].title.slice(0, 10)}
                                    ...
                                  </div>
                                )}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* 범례 */}
                    <div className="flex items-center gap-4 mt-3 px-1">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] text-gray-500">
                          매칭 사업
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-gray-400" />
                        <span className="text-[10px] text-gray-500">
                          기타 사업
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* 리스트 뷰 */
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {monthEvents.length === 0 ? (
                      <div className="py-8 text-center text-sm text-gray-400">
                        이번 달 마감 사업이 없습니다
                      </div>
                    ) : (
                      monthEvents.map((e) => {
                        const dday = getDday(e.applyEnd!);
                        return (
                          <Link
                            key={e.id}
                            href={`/programs/${e.programId}`}
                            className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                          >
                            <div className="shrink-0">
                              <Badge
                                className={`text-[10px] ${getDdayColor(dday)}`}
                              >
                                {getDdayLabel(dday)}
                              </Badge>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">
                                {e.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400">
                                  {e.institution}
                                </span>
                                <span className="text-[10px] text-gray-300">
                                  ~
                                  {new Date(e.applyEnd!).toLocaleDateString(
                                    "ko-KR"
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {e.isMatched && (
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              )}
                              {e.matchScore && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {e.matchScore}점
                                </Badge>
                              )}
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 우측 사이드패널 */}
          <div className="space-y-4">
            {/* 선택 날짜 이벤트 */}
            {selectedDate && selectedEvents.length > 0 ? (
              <Card className="border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                      "ko-KR",
                      {
                        month: "long",
                        day: "numeric",
                        weekday: "short",
                      }
                    )}{" "}
                    마감
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {selectedEvents.map((e) => {
                    const dday = getDday(e.applyEnd!);
                    return (
                      <Link
                        key={e.id}
                        href={`/programs/${e.programId}`}
                        className="block rounded-lg border border-gray-200 p-3 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                          >
                            {SOURCE_LABELS[e.source] || e.source}
                          </Badge>
                          {e.fitLevel && (
                            <Badge
                              className={`text-[10px] ${
                                FIT_COLORS[e.fitLevel] || ""
                              }`}
                            >
                              {e.fitLevel}
                            </Badge>
                          )}
                          <Badge
                            className={`text-[10px] ml-auto ${getDdayColor(dday)}`}
                          >
                            {getDdayLabel(dday)}
                          </Badge>
                        </div>
                        <p className="text-xs font-semibold text-gray-800 mb-1">
                          {e.title}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {e.institution}
                          </span>
                          {e.matchScore && (
                            <span className="text-[10px] font-medium text-blue-600">
                              매칭 {e.matchScore}점
                            </span>
                          )}
                        </div>
                        {e.matchReason && (
                          <p className="text-[10px] text-gray-500 mt-1.5 line-clamp-2">
                            {e.matchReason}
                          </p>
                        )}
                        {e.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {e.hashtags.slice(0, 3).map((tag, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[9px]"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            ) : selectedDate ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <CalendarDays className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    이 날짜에 마감 사업이 없습니다
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {/* 곧 마감 안내 (선택 날짜 없을 때) */}
            {!selectedDate && urgentEvents.length > 0 && (
              <Card className="border-orange-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    곧 마감 ({urgentEvents.length}건)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {urgentEvents.slice(0, 5).map((e) => {
                    const dday = getDday(e.applyEnd!);
                    return (
                      <Link
                        key={e.id}
                        href={`/programs/${e.programId}`}
                        className="flex items-center gap-2 rounded-lg p-2 hover:bg-orange-50 transition-colors"
                      >
                        <Badge
                          className={`text-[10px] shrink-0 ${getDdayColor(dday)}`}
                        >
                          {getDdayLabel(dday)}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-gray-800 truncate">
                            {e.title}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {e.institution}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* 알림 설정 카드 (향후 기능) */}
            <Card className="border-dashed border-gray-300">
              <CardContent className="py-6 text-center">
                <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-500 mb-1">
                  마감 알림 (준비 중)
                </p>
                <p className="text-[10px] text-gray-400">
                  카카오톡으로 마감 3일 전 알림을 보내드립니다
                </p>
                <Badge
                  variant="outline"
                  className="mt-2 text-[10px] text-gray-400"
                >
                  Coming Soon
                </Badge>
              </CardContent>
            </Card>

            {/* 빠른 이동 */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                  빠른 이동
                </p>
                <Link
                  href="/programs"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                >
                  <Search className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-gray-700">지원사업 검색</span>
                  <ArrowRight className="h-3 w-3 text-gray-400 ml-auto" />
                </Link>
                <Link
                  href="/plans"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                >
                  <Target className="h-3.5 w-3.5 text-purple-600" />
                  <span className="text-gray-700">사업계획서</span>
                  <ArrowRight className="h-3 w-3 text-gray-400 ml-auto" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
