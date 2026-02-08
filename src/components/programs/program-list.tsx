"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  Search,
  Calendar,
  MapPin,
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

interface Program {
  id: string;
  title: string;
  summary?: string;
  source: string;
  institution?: string;
  apply_start?: string;
  apply_end?: string;
  hashtags?: string[];
  matchScore?: number;
  matchReason?: string;
}

interface ProgramListProps {
  matchedPrograms: Program[];
  allPrograms: Program[];
}

const ITEMS_PER_PAGE = 12;

const REGION_OPTIONS = ["전국", "서울", "경기", "부산", "인천", "대구", "대전", "광주", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

export function ProgramList({ matchedPrograms, allPrograms }: ProgramListProps) {
  const [viewMode, setViewMode] = useState<"matched" | "all">("matched");
  const [page, setPage] = useState(1);
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showScorePicker, setShowScorePicker] = useState(false);
  const [deadlineFilter, setDeadlineFilter] = useState<string | null>(null);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);

  const basePrograms = viewMode === "matched" ? matchedPrograms : allPrograms;

  const filteredPrograms = useMemo(() => {
    let result = [...basePrograms];

    if (regionFilter) {
      result = result.filter((p) =>
        p.hashtags?.some((t) => t.includes(regionFilter))
      );
    }

    if (sourceFilter) {
      result = result.filter((p) => p.source === sourceFilter);
    }

    if (viewMode === "matched" && (scoreRange[0] > 0 || scoreRange[1] < 100)) {
      result = result.filter(
        (p) => (p.matchScore || 0) >= scoreRange[0] && (p.matchScore || 0) <= scoreRange[1]
      );
    }

    if (deadlineFilter) {
      const now = new Date();
      const cutoff = new Date();
      if (deadlineFilter === "1week") cutoff.setDate(now.getDate() + 7);
      else if (deadlineFilter === "1month") cutoff.setMonth(now.getMonth() + 1);
      else if (deadlineFilter === "3months") cutoff.setMonth(now.getMonth() + 3);

      result = result.filter((p) => {
        if (!p.apply_end) return false;
        const end = new Date(p.apply_end);
        return end >= now && end <= cutoff;
      });
    }

    return result;
  }, [basePrograms, regionFilter, sourceFilter, scoreRange, deadlineFilter, viewMode]);

  const totalPages = Math.ceil(filteredPrograms.length / ITEMS_PER_PAGE);
  const paginatedPrograms = filteredPrograms.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const activeFilterCount = [regionFilter, sourceFilter, deadlineFilter].filter(Boolean).length +
    (scoreRange[0] > 0 || scoreRange[1] < 100 ? 1 : 0);

  const clearFilters = () => {
    setRegionFilter(null);
    setSourceFilter(null);
    setScoreRange([0, 100]);
    setDeadlineFilter(null);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">지원사업</h1>
          <p className="text-gray-500">AI가 매칭한 정부지원사업 목록</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setViewMode("matched"); setPage(1); }}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              viewMode === "matched"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {matchedPrograms.length}건 매칭
          </button>
          <button
            onClick={() => { setViewMode("all"); setPage(1); }}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              viewMode === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {allPrograms.length}건 전체
          </button>
        </div>
      </div>

      {/* 필터 영역 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* 지역 필터 */}
            <div className="relative">
              <Button
                variant={regionFilter ? "default" : "outline"}
                size="sm"
                className="gap-1"
                onClick={() => {
                  setShowRegionPicker(!showRegionPicker);
                  setShowSourcePicker(false);
                  setShowScorePicker(false);
                  setShowDeadlinePicker(false);
                }}
              >
                <MapPin className="h-3 w-3" /> {regionFilter || "지역"}
              </Button>
              {showRegionPicker && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border p-2 w-48 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => { setRegionFilter(null); setShowRegionPicker(false); setPage(1); }}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100"
                  >
                    전체
                  </button>
                  {REGION_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => { setRegionFilter(r); setShowRegionPicker(false); setPage(1); }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100",
                        regionFilter === r && "bg-blue-50 text-blue-700"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 분야(소스) 필터 */}
            <div className="relative">
              <Button
                variant={sourceFilter ? "default" : "outline"}
                size="sm"
                className="gap-1"
                onClick={() => {
                  setShowSourcePicker(!showSourcePicker);
                  setShowRegionPicker(false);
                  setShowScorePicker(false);
                  setShowDeadlinePicker(false);
                }}
              >
                <Building2 className="h-3 w-3" />
                {sourceFilter === "bizinfo" ? "기업마당" : sourceFilter === "mss" ? "중소벤처" : sourceFilter === "kstartup" ? "K-Startup" : "분야"}
              </Button>
              {showSourcePicker && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border p-2 w-40">
                  {[
                    { value: null, label: "전체" },
                    { value: "bizinfo", label: "기업마당" },
                    { value: "mss", label: "중소벤처" },
                    { value: "kstartup", label: "K-Startup" },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => { setSourceFilter(opt.value); setShowSourcePicker(false); setPage(1); }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100",
                        sourceFilter === opt.value && "bg-blue-50 text-blue-700"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 마감일 필터 */}
            <div className="relative">
              <Button
                variant={deadlineFilter ? "default" : "outline"}
                size="sm"
                className="gap-1"
                onClick={() => {
                  setShowDeadlinePicker(!showDeadlinePicker);
                  setShowRegionPicker(false);
                  setShowSourcePicker(false);
                  setShowScorePicker(false);
                }}
              >
                <Calendar className="h-3 w-3" />
                {deadlineFilter === "1week" ? "1주 이내" : deadlineFilter === "1month" ? "1개월 이내" : deadlineFilter === "3months" ? "3개월 이내" : "마감일"}
              </Button>
              {showDeadlinePicker && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border p-2 w-40">
                  {[
                    { value: null, label: "전체" },
                    { value: "1week", label: "1주 이내" },
                    { value: "1month", label: "1개월 이내" },
                    { value: "3months", label: "3개월 이내" },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => { setDeadlineFilter(opt.value); setShowDeadlinePicker(false); setPage(1); }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100",
                        deadlineFilter === opt.value && "bg-blue-50 text-blue-700"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 점수 범위 (매칭 탭에서만) */}
            {viewMode === "matched" && (
              <div className="relative">
                <Button
                  variant={scoreRange[0] > 0 || scoreRange[1] < 100 ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    setShowScorePicker(!showScorePicker);
                    setShowRegionPicker(false);
                    setShowSourcePicker(false);
                    setShowDeadlinePicker(false);
                  }}
                >
                  <Search className="h-3 w-3" />
                  {scoreRange[0] > 0 || scoreRange[1] < 100
                    ? `${scoreRange[0]}~${scoreRange[1]}점`
                    : "점수 범위"}
                </Button>
                {showScorePicker && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border p-2 w-40">
                    {[
                      { range: [0, 100] as [number, number], label: "전체" },
                      { range: [80, 100] as [number, number], label: "80점 이상" },
                      { range: [60, 100] as [number, number], label: "60점 이상" },
                      { range: [40, 100] as [number, number], label: "40점 이상" },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => { setScoreRange(opt.range); setShowScorePicker(false); setPage(1); }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100",
                          scoreRange[0] === opt.range[0] && scoreRange[1] === opt.range[1] && "bg-blue-50 text-blue-700"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 필터 초기화 */}
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="gap-1 text-red-600" onClick={clearFilters}>
                <X className="h-3 w-3" /> 초기화
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 결과 카운트 */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {filteredPrograms.length}건 검색됨
          {activeFilterCount > 0 && ` (필터 ${activeFilterCount}개 적용)`}
        </span>
        {totalPages > 1 && (
          <span>
            {page} / {totalPages} 페이지
          </span>
        )}
      </div>

      {/* 프로그램 카드 */}
      {paginatedPrograms.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedPrograms.map((program) => (
            <Link key={program.id} href={`/programs/${program.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="outline" className="text-xs">
                      {program.source === "bizinfo"
                        ? "기업마당"
                        : program.source === "mss"
                        ? "중소벤처"
                        : "K-Startup"}
                    </Badge>
                    {program.matchScore && (
                      <div
                        className={cn(
                          "flex items-center justify-center h-10 w-10 rounded-full font-bold text-sm",
                          program.matchScore >= 80
                            ? "bg-green-50 text-green-700"
                            : program.matchScore >= 60
                            ? "bg-blue-50 text-blue-700"
                            : program.matchScore >= 40
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-gray-50 text-gray-600"
                        )}
                      >
                        {program.matchScore}
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                    {program.title}
                  </h3>
                  {program.summary && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {program.summary}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {program.hashtags?.slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{program.institution}</span>
                    {program.apply_end && (
                      <span>
                        ~{new Date(program.apply_end).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </div>
                  {program.matchReason && (
                    <p className="mt-3 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 line-clamp-2">
                      {program.matchReason}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Search className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-900">
              {activeFilterCount > 0 ? "필터 조건에 맞는 지원사업이 없습니다" : "아직 수집된 지원사업이 없습니다"}
            </h3>
            <p className="mt-2 text-sm text-gray-500 text-center">
              {activeFilterCount > 0
                ? "필터를 조정하거나 초기화해 보세요"
                : "정부지원사업 데이터를 수집하면 AI가 자동으로 매칭합니다."}
            </p>
            {activeFilterCount > 0 && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                필터 초기화
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="sm"
              onClick={() => setPage(p)}
              className="w-9"
            >
              {p}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
