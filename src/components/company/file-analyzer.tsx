"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  AlertCircle,
  ExternalLink,
  Briefcase,
  BarChart3,
  DollarSign,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";

interface AnalysisResult {
  summary: string;
  category?: string;
  key_data?: { label: string; value: string }[];
  insights?: string[];
  full_analysis?: string;
  applicable_fields?: {
    industry?: string;
    revenue?: string;
    employee_count?: string;
    established_date?: string;
    business_content_addition?: string;
  };
}

interface AnalyzedFile {
  id: string;
  fileName: string;
  fileType: string;
  analysis: AnalysisResult;
  fileUrl: string;
  analyzedAt: string;
}

const FILE_TYPES = [
  {
    value: "company_intro",
    label: "회사소개서",
    icon: Briefcase,
    desc: "회사 IR, 소개 자료",
  },
  {
    value: "business_plan",
    label: "사업계획서",
    icon: FileText,
    desc: "기존 작성한 사업계획서",
  },
  {
    value: "financial",
    label: "재무자료",
    icon: DollarSign,
    desc: "손익계산서, 재무제표",
  },
  {
    value: "other",
    label: "기타 자료",
    icon: FolderOpen,
    desc: "제품 카탈로그, 인증서 등",
  },
];

interface FileAnalyzerProps {
  companyId: string;
  onDataExtracted?: (fields: AnalysisResult["applicable_fields"]) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- will be used for per-company file storage
export function FileAnalyzer({ companyId, onDataExtracted }: FileAnalyzerProps) {
  const [analyzedFiles, setAnalyzedFiles] = useState<AnalyzedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState("company_intro");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUploadArea, setShowUploadArea] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", selectedFileType);

      const res = await fetch("/api/company/analyze-file", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "파일 분석 실패");
      }

      const data = await res.json();

      const newFile: AnalyzedFile = {
        id: data.documentId || Date.now().toString(),
        fileName: file.name,
        fileType: selectedFileType,
        analysis: data.analysis,
        fileUrl: data.fileUrl,
        analyzedAt: new Date().toISOString(),
      };

      setAnalyzedFiles((prev) => [newFile, ...prev]);
      setExpandedId(newFile.id);
      setShowUploadArea(false);

      // 추출된 필드가 있으면 콜백
      if (data.analysis?.applicable_fields && onDataExtracted) {
        onDataExtracted(data.analysis.applicable_fields);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "파일 분석 중 오류가 발생했습니다";
      setError(errMsg);
    } finally {
      setUploading(false);
      // input 초기화
      e.target.value = "";
    }
  };

  const removeFile = (id: string) => {
    setAnalyzedFiles((prev) => prev.filter((f) => f.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const fileTypeConfig = FILE_TYPES.find((ft) => ft.value === selectedFileType);

  return (
    <Card className="border-purple-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            AI 자료 분석기
          </CardTitle>
          <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-600">
            {analyzedFiles.length}개 분석 완료
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          회사 관련 자료를 업로드하면 AI가 읽고 핵심 데이터를 정리합니다
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* 혜택 안내 — 파일 0개일 때 */}
        {analyzedFiles.length === 0 && !showUploadArea && (
          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  icon: BarChart3,
                  title: "계획서 품질↑",
                  desc: "실제 데이터 기반 작성",
                },
                {
                  icon: Sparkles,
                  title: "매칭 정확도↑",
                  desc: "정확한 프로필 구축",
                },
                {
                  icon: DollarSign,
                  title: "수치 자동 반영",
                  desc: "매출/직원 자동 입력",
                },
              ].map((benefit, i) => {
                const Icon = benefit.icon;
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center text-center gap-1 p-2"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                      <Icon className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="text-[10px] font-semibold text-gray-800">
                      {benefit.title}
                    </span>
                    <span className="text-[9px] text-gray-500">
                      {benefit.desc}
                    </span>
                  </div>
                );
              })}
            </div>
            <Button
              onClick={() => setShowUploadArea(true)}
              className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              size="sm"
            >
              <Upload className="h-3.5 w-3.5" />
              자료 올리기
            </Button>
          </div>
        )}

        {/* 업로드 영역 */}
        {(showUploadArea || analyzedFiles.length > 0) && (
          <div className="space-y-2">
            {/* 파일 유형 선택 */}
            <div className="grid grid-cols-2 gap-1.5">
              {FILE_TYPES.map((ft) => {
                const Icon = ft.icon;
                const isSelected = selectedFileType === ft.value;
                return (
                  <button
                    key={ft.value}
                    onClick={() => setSelectedFileType(ft.value)}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      isSelected
                        ? "border-purple-300 bg-purple-50 text-purple-700"
                        : "border-gray-200 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isSelected ? "text-purple-600" : "text-gray-400"
                      }`}
                    />
                    <div>
                      <p className="text-[11px] font-medium">{ft.label}</p>
                      <p className="text-[9px] text-gray-400">{ft.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 드래그&드롭 영역 */}
            <label
              className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                uploading
                  ? "border-purple-300 bg-purple-50"
                  : "border-gray-300 hover:border-purple-400 hover:bg-gray-50"
              }`}
            >
              {uploading ? (
                <div className="flex items-center gap-2 text-purple-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <div className="text-center">
                    <span className="text-sm font-medium">AI 분석 중...</span>
                    <p className="text-[10px] text-purple-400 mt-0.5">
                      파일을 읽고 데이터를 추출하고 있습니다
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-400">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs font-medium">
                    {fileTypeConfig?.label || "파일"} 업로드
                  </span>
                  <span className="text-[10px]">
                    PDF, PNG, JPG (10MB 이하)
                  </span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* 분석 결과 목록 */}
        {analyzedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                분석 결과
              </p>
              <button
                onClick={() => setShowUploadArea(true)}
                className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-700"
              >
                <Plus className="h-3 w-3" />
                추가 업로드
              </button>
            </div>

            {analyzedFiles.map((af) => {
              const isExpanded = expandedId === af.id;
              const ftConfig = FILE_TYPES.find(
                (ft) => ft.value === af.fileType
              );
              const FtIcon = ftConfig?.icon || FileText;

              return (
                <div
                  key={af.id}
                  className="rounded-lg border border-gray-200 overflow-hidden"
                >
                  {/* 파일 헤더 */}
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : af.id)
                    }
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 shrink-0">
                      <FtIcon className="h-3.5 w-3.5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">
                        {af.fileName}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {af.analysis.summary || "분석 완료"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* 펼쳐진 분석 결과 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-3 py-3 space-y-3 bg-gray-50/50">
                      {/* 핵심 데이터 */}
                      {af.analysis.key_data &&
                        af.analysis.key_data.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium text-gray-500 mb-1.5">
                              핵심 데이터
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {af.analysis.key_data
                                .slice(0, 8)
                                .map((kd, i) => (
                                  <div
                                    key={i}
                                    className="rounded-lg bg-white px-2.5 py-1.5 border border-gray-100"
                                  >
                                    <p className="text-[9px] text-gray-400">
                                      {kd.label}
                                    </p>
                                    <p className="text-[11px] font-medium text-gray-800 truncate">
                                      {kd.value}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                      {/* 인사이트 */}
                      {af.analysis.insights &&
                        af.analysis.insights.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium text-gray-500 mb-1.5">
                              AI 인사이트
                            </p>
                            <div className="space-y-1">
                              {af.analysis.insights
                                .slice(0, 5)
                                .map((insight, i) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-1.5 text-[11px] text-gray-700"
                                  >
                                    <Sparkles className="h-3 w-3 text-purple-400 mt-0.5 shrink-0" />
                                    <span>{insight}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                      {/* 상세 분석 */}
                      {af.analysis.full_analysis && (
                        <div>
                          <p className="text-[10px] font-medium text-gray-500 mb-1.5">
                            상세 분석
                          </p>
                          <div className="rounded-lg bg-white border border-gray-100 px-3 py-2 max-h-48 overflow-y-auto">
                            <div className="text-[11px] prose prose-xs max-w-none [&>p]:my-0.5 [&>ul]:my-0.5 [&>h3]:text-xs [&>h3]:mt-1">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {af.analysis.full_analysis}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 추출 가능한 필드 */}
                      {af.analysis.applicable_fields &&
                        Object.values(af.analysis.applicable_fields).some(
                          (v) => v
                        ) && (
                          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                            <p className="text-[10px] font-medium text-blue-700 mb-1">
                              회사 프로필에 반영 가능한 정보
                            </p>
                            <div className="space-y-0.5">
                              {af.analysis.applicable_fields.industry && (
                                <p className="text-[10px] text-blue-600">
                                  • 업종:{" "}
                                  {af.analysis.applicable_fields.industry}
                                </p>
                              )}
                              {af.analysis.applicable_fields.revenue && (
                                <p className="text-[10px] text-blue-600">
                                  • 매출:{" "}
                                  {af.analysis.applicable_fields.revenue}
                                </p>
                              )}
                              {af.analysis.applicable_fields.employee_count && (
                                <p className="text-[10px] text-blue-600">
                                  • 직원수:{" "}
                                  {af.analysis.applicable_fields.employee_count}
                                  명
                                </p>
                              )}
                              {af.analysis.applicable_fields
                                .business_content_addition && (
                                <p className="text-[10px] text-blue-600">
                                  • 사업 프로필 보강 가능
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                      {/* 액션 버튼 */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => removeFile(af.id)}
                          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          삭제
                        </button>
                        {af.fileUrl && (
                          <a
                            href={af.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-700"
                          >
                            <ExternalLink className="h-3 w-3" />
                            원본 보기
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 지원 가능 파일 안내 */}
        {showUploadArea && analyzedFiles.length === 0 && (
          <p className="text-[9px] text-gray-300 text-center">
            업로드된 파일은 AI 분석에만 사용되며, 안전하게 보관됩니다
          </p>
        )}
      </CardContent>
    </Card>
  );
}
