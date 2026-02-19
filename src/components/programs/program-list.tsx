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
  ChevronDown,
  X,
  Sparkles,
  Loader2,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";

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
  matchKeywords?: string[];
  fitLevel?: string;
  scoreBreakdown?: {
    keyword_relevance?: number;
    direction_fit?: number;
    eligibility?: number;
    necessity?: number;
    competitiveness?: number;
  } | null;
  matchDetail?: string;
}

const BREAKDOWN_LABELS: { key: string; label: string; max: number }[] = [
  { key: "keyword_relevance", label: "키워드 연관", max: 30 },
  { key: "direction_fit", label: "사업방향 일치", max: 25 },
  { key: "eligibility", label: "자격요건 부합", max: 20 },
  { key: "necessity", label: "필요성/활용", max: 15 },
  { key: "competitiveness", label: "선정 가능성", max: 10 },
];

// 예시 점수 (실제 프로그램 앞 3개에 덧씌울 가짜 매칭 데이터)
const SAMPLE_SCORES = [
  { matchScore: 85, fitLevel: "매우적합" },
  { matchScore: 72, fitLevel: "적합" },
  { matchScore: 58, fitLevel: "검토추천" },
];

interface ProgramListProps {
  matchedPrograms: Program[];
  allPrograms: Program[];
  companyId: string;
}

const ITEMS_PER_PAGE = 12;

const REGION_OPTIONS = ["전국", "서울", "경기", "부산", "인천", "대구", "대전", "광주", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

export function ProgramList({ matchedPrograms, allPrograms, companyId }: ProgramListProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"matched" | "all">(
    matchedPrograms.length > 0 ? "matched" : "all"
  );
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [regionFilter, setRegionFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showScorePicker, setShowScorePicker] = useState(false);
  const [deadlineFilter, setDeadlineFilter] = useState<string | null>(null);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [expandedBreakdown, setExpandedBreakdown] = useState<string | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const handleRunMatching = async () => {
    setIsMatching(true);
    setMatchError(null);
    try {
      const res = await fetch("/api/matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMatchError(data.error || "매칭 실행 중 오류가 발생했습니다");
        return;
      }
      // 매칭 성공 — 페이지 새로고침으로 결과 반영
      router.refresh();
    } catch {
      setMatchError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsMatching(false);
    }
  };

  const basePrograms = viewMode === "matched" ? matchedPrograms : allPrograms;

  const filteredPrograms = useMemo(() => {
    let result = [...basePrograms];

    // 검색어 필터 (제목 + 기관명)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.institution && p.institution.toLowerCase().includes(q)) ||
          (p.hashtags && p.hashtags.some((t) => t.toLowerCase().includes(q)))
      );
    }

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
  }, [basePrograms, searchQuery, regionFilter, sourceFilter, scoreRange, deadlineFilter, viewMode]);

  const totalPages = Math.ceil(filteredPrograms.length / ITEMS_PER_PAGE);
  const paginatedPrograms = filteredPrograms.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const activeFilterCount = [regionFilter, sourceFilter, deadlineFilter, searchQuery].filter(Boolean).length +
    (scoreRange[0] > 0 || scoreRange[1] < 100 ? 1 : 0);

  const clearFilters = () => {
    setSearchQuery("");
    setSearchInput("");
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
        <div className="flex gap-2 items-center">
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
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            disabled={isMatching}
            onClick={handleRunMatching}
          >
            {isMatching ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                매칭 중...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                지금 매칭하기
              </>
            )}
          </Button>
        </div>
      </div>
      {/* 매칭 오류 메시지 */}
      {matchError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center justify-between">
          <span>{matchError}</span>
          <button onClick={() => setMatchError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 검색 입력 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearchQuery(searchInput);
          setPage(1);
        }}
        className="relative"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            if (e.target.value === "") {
              setSearchQuery("");
              setPage(1);
            }
          }}
          placeholder="지원사업명, 기관명, 키워드로 검색..."
          className="w-full h-10 pl-10 pr-20 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearchQuery("");
              setPage(1);
            }}
            className="absolute right-14 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-3 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          검색
        </button>
      </form>

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
          {/* 예시 카드 3개 — 매칭 결과 없고 첫 페이지일 때 */}
          {matchedPrograms.length === 0 && page === 1 && allPrograms.length >= 3 &&
            allPrograms.slice(0, 3).map((prog, idx) => {
              const sample = SAMPLE_SCORES[idx];
              return (
                <Link key={`example-${prog.id}`} href={`/programs/${prog.id}?sample=${sample.matchScore}&fit=${encodeURIComponent(sample.fitLevel)}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-blue-300 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                      예시
                    </div>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs">
                            {prog.source === "bizinfo" ? "기업마당" : prog.source === "mss" ? "중소벤처" : "K-Startup"}
                          </Badge>
                          <Badge
                            className={cn(
                              "text-xs",
                              sample.fitLevel === "매우적합"
                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                : sample.fitLevel === "적합"
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                                : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                            )}
                          >
                            {sample.fitLevel}
                          </Badge>
                        </div>
                        <div
                          className={cn(
                            "flex items-center justify-center h-10 w-10 rounded-full font-bold text-sm",
                            sample.matchScore >= 80
                              ? "bg-green-50 text-green-700"
                              : sample.matchScore >= 60
                              ? "bg-blue-50 text-blue-700"
                              : "bg-yellow-50 text-yellow-700"
                          )}
                        >
                          {sample.matchScore}
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                        {prog.title}
                      </h3>
                      {prog.hashtags && prog.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {prog.hashtags.slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{prog.institution}</span>
                        {prog.apply_end && (
                          <span>~{new Date(prog.apply_end).toLocaleDateString("ko-KR")}</span>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-blue-600 bg-blue-50/80 rounded-lg px-3 py-2 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 flex-shrink-0" />
                        AI 매칭 분석 결과 — 클릭하여 상세 확인
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          }
          {paginatedPrograms.map((program) => {
            // HTML 태그 제거 헬퍼
            const stripHtml = (html: string) =>
              html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

            const cleanSummary = program.summary ? stripHtml(program.summary) : "";

            return (
            <Link key={program.id} href={`/programs/${program.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        {program.source === "bizinfo"
                          ? "기업마당"
                          : program.source === "mss"
                          ? "중소벤처"
                          : "K-Startup"}
                      </Badge>
                      {program.fitLevel && (
                        <Badge
                          className={cn(
                            "text-xs",
                            program.fitLevel === "매우적합"
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : program.fitLevel === "적합"
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                              : program.fitLevel === "검토추천"
                              ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                          )}
                        >
                          {program.fitLevel}
                        </Badge>
                      )}
                    </div>
                    {program.matchScore != null && program.matchScore > 0 && (
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
                  {/* 매칭 키워드 (있으면 우선 표시) */}
                  {program.matchKeywords && program.matchKeywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {program.matchKeywords.slice(0, 4).map((kw, i) => (
                        <Badge key={i} className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  ) : program.hashtags && program.hashtags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {program.hashtags.slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {cleanSummary && !program.matchReason && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                      {cleanSummary}
                    </p>
                  )}
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
                  {program.scoreBreakdown && program.matchScore && program.matchScore > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setExpandedBreakdown(
                            expandedBreakdown === program.id ? null : program.id
                          );
                        }}
                        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-600 transition-colors"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 transition-transform",
                            expandedBreakdown === program.id && "rotate-180"
                          )}
                        />
                        점수 상세 보기
                      </button>
                      {expandedBreakdown === program.id && (
                        <div
                          className="mt-2 space-y-1.5 bg-gray-50 rounded-lg p-3"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                          {BREAKDOWN_LABELS.map((dim) => {
                            const score = (program.scoreBreakdown as any)?.[dim.key] ?? 0;
                            const pct = Math.round((score / dim.max) * 100);
                            return (
                              <div key={dim.key} className="flex items-center gap-2 text-[11px]">
                                <span className="w-20 text-gray-500 flex-shrink-0">{dim.label}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-gray-200">
                                  <div
                                    className={cn(
                                      "h-1.5 rounded-full transition-all",
                                      pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : pct >= 40 ? "bg-yellow-500" : "bg-gray-400"
                                    )}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="w-10 text-right text-gray-600 flex-shrink-0 font-medium">
                                  {score}/{dim.max}
                                </span>
                              </div>
                            );
                          })}
                          {program.matchDetail && (
                            <p className="text-[11px] text-gray-500 mt-2 pt-2 border-t border-gray-200 leading-relaxed">
                              {program.matchDetail}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
            );
          })}
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
                : "정부지원사업 데이터가 매일 자동 수집됩니다. 잠시 후 다시 확인해주세요."}
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
