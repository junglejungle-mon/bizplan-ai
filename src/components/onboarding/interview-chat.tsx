"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Loader2,
  TrendingUp,
  Database,
  Target,
  Users,
  Shield,
  Briefcase,
  Paperclip,
  FileText,
  Upload,
  Sparkles,
  RotateCcw,
} from "lucide-react";

interface ChatMessage {
  role: "assistant" | "user" | "system";
  content: string;
}

interface RoundSummary {
  collected_data: string[];
  data_quality: string;
  missing_for_plan: string[];
  strategic_insights: string[];
  interim_score: number;
}

interface UploadedFileInfo {
  name: string;
  summary: string;
}

const ROUND_CONFIG = [
  { num: 1, label: "사업 핵심", icon: Target, color: "blue" },
  { num: 2, label: "기술/제품", icon: Database, color: "purple" },
  { num: 3, label: "팀/실적", icon: Users, color: "green" },
  { num: 4, label: "성장 전략", icon: TrendingUp, color: "orange" },
  { num: 5, label: "지원 최적화", icon: Shield, color: "red" },
];

interface InterviewChatProps {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onSkip: () => void;
  loading: boolean;
  streamingText: string;
  currentRound: number;
  profileScore: number;
  collectedDataCount: number;
  showRoundTransition: boolean;
  roundTransitionData: RoundSummary | null;
  onFileAnalyzed?: (summary: string) => void;
  onReset?: () => void;
}

export function InterviewChat({
  messages,
  input,
  onInputChange,
  onSend,
  onSkip,
  loading,
  streamingText,
  currentRound,
  profileScore,
  collectedDataCount,
  showRoundTransition,
  roundTransitionData,
  onFileAnalyzed,
  onReset,
}: InterviewChatProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const answeredCount = messages.filter((m) => m.role === "user").length;
  const totalQuestions = uploadedFiles.length > 0 ? 10 : 15; // 파일 업로드 시 질문 축소

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 파일명으로 유형 자동 분류
      const fileName = file.name.toLowerCase();
      let fileType = "company_intro";
      if (fileName.includes("재무") || fileName.includes("손익") || fileName.includes("대차") || fileName.includes("financial")) {
        fileType = "financial";
      } else if (fileName.includes("사업계획") || fileName.includes("business") || fileName.includes("계획서")) {
        fileType = "business_plan";
      } else if (fileName.includes("소개") || fileName.includes("ir") || fileName.includes("회사")) {
        fileType = "company_intro";
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", fileType);

      const res = await fetch("/api/company/analyze-file", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "파일 분석 실패");
      }

      const data = await res.json();
      const analysis = data.analysis || {};

      const keyDataSummary = (analysis.key_data || [])
        .slice(0, 5)
        .map((kd: { label: string; value: string }) => `• ${kd.label}: ${kd.value}`)
        .join("\n");

      const fileSummary = `📎 "${file.name}" 분석 완료!\n\n📋 ${analysis.summary || "파일 분석 완료"}\n\n${keyDataSummary ? `📊 핵심 데이터:\n${keyDataSummary}` : ""}\n\n${data.autoUpdated ? "✅ 회사 정보가 자동 업데이트되었습니다." : "💡 이 정보가 인터뷰 답변에 자동 반영됩니다."}`;

      setUploadedFiles((prev) => [
        ...prev,
        { name: file.name, summary: analysis.summary || "" },
      ]);

      if (onFileAnalyzed) {
        onFileAnalyzed(fileSummary);
      }
    } catch (err: unknown) {
      if (onFileAnalyzed) {
        const errMsg = err instanceof Error ? err.message : String(err);
        onFileAnalyzed(`⚠️ 파일 분석 실패: ${errMsg}`);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 채팅 영역 */}
      <div className="flex flex-1 flex-col">
        {/* 상단 바 */}
        <div className="flex items-center justify-between border-b bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">AI 사업 전략 인터뷰</h2>
              <p className="text-xs text-gray-500">
                {answeredCount}/{totalQuestions} 질문 완료
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {ROUND_CONFIG.map((rc) => {
              const Icon = rc.icon;
              const isActive = currentRound === rc.num;
              const isDone = currentRound > rc.num;
              return (
                <div
                  key={rc.num}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                    isActive
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : isDone
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  <span className="hidden sm:inline">{rc.label}</span>
                </div>
              );
            })}
            {onReset && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="ml-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                title="인터뷰 처음부터 다시하기"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                리셋
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs">
              건너뛰기
            </Button>
          </div>
        </div>

        {/* 라운드 전환 배너 */}
        {showRoundTransition && roundTransitionData && (
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 animate-pulse">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Round {currentRound} 시작!</p>
                <p className="text-xs opacity-80">
                  확보 데이터: {roundTransitionData.collected_data?.length || 0}개 | 프로필: {profileScore}%
                </p>
              </div>
              <Badge className="bg-white/20 text-white border-0">
                {ROUND_CONFIG[currentRound - 1]?.label || ""}
              </Badge>
            </div>
          </div>
        )}

        {/* 채팅 메시지 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user"
                  ? "justify-end"
                  : msg.role === "system"
                  ? "justify-center"
                  : "justify-start"
              }`}
            >
              {msg.role === "system" ? (
                <div className="max-w-[90%] rounded-xl px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-gray-700">
                  <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                </div>
              ) : (
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-800"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              )}
            </div>
          ))}

          {/* 파일 업로드 중 표시 */}
          {uploading && (
            <div className="flex justify-center">
              <div className="rounded-xl px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  <span className="text-xs text-purple-700 font-medium">
                    파일을 AI가 분석하고 있습니다...
                  </span>
                </div>
              </div>
            </div>
          )}

          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-white border border-gray-200 text-gray-800">
                <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
              </div>
            </div>
          )}

          {loading && !streamingText && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 bg-white border border-gray-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-xs text-gray-500">AI가 분석하고 있습니다...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="border-t bg-white px-6 py-4">
          {/* 업로드된 파일 표시 */}
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {uploadedFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1"
                >
                  <FileText className="h-3 w-3 text-purple-600" />
                  <span className="text-[11px] text-purple-700 font-medium">
                    {f.name}
                  </span>
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            {/* 파일 첨부 버튼 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || loading}
              className={`flex items-center justify-center h-12 w-12 rounded-xl border-2 border-dashed transition-colors self-end shrink-0 ${
                uploading
                  ? "border-purple-300 bg-purple-50"
                  : "border-gray-300 hover:border-purple-400 hover:bg-purple-50 text-gray-400 hover:text-purple-600"
              }`}
              title="회사소개서, 사업계획서 등 자료 첨부"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileUpload}
              disabled={uploading || loading}
            />

            <textarea
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="답변을 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              disabled={loading}
              rows={2}
            />
            <Button
              onClick={onSend}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-12 w-12 rounded-xl self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-400 text-center">
            모르는 질문은 &quot;잘 모르겠어요&quot; 라고 답해도 괜찮습니다. AI가 추정치로 보완합니다.
            &nbsp;|&nbsp;
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-purple-500 hover:text-purple-700 font-medium"
              disabled={uploading}
            >
              📎 회사자료 첨부하면 프로필이 빠르게 완성됩니다
            </button>
          </p>
        </div>
      </div>

      {/* 우측 프로필 패널 */}
      <div className="hidden xl:flex xl:w-80 xl:flex-col xl:border-l xl:bg-white xl:p-6 xl:overflow-y-auto">
        <h3 className="font-semibold text-gray-900 mb-4">프로필 구축 현황</h3>

        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">프로필 완성도</span>
            <span className="font-bold text-blue-600">{profileScore}%</span>
          </div>
          <div className="h-3 rounded-full bg-gray-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-700"
              style={{ width: `${profileScore}%` }}
            />
          </div>
        </div>

        {/* 자료 업로드 유도 카드 */}
        <div className="mb-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-xl border-2 border-dashed border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50 p-4 hover:border-purple-400 transition-colors text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                ) : (
                  <Upload className="h-4 w-4 text-purple-600" />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-purple-800">
                  {uploading ? "분석 중..." : "자료 첨부로 빠른 완성"}
                </p>
                <p className="text-[10px] text-purple-600">
                  회사소개서, 사업계획서 등
                </p>
              </div>
            </div>
            {uploadedFiles.length > 0 ? (
              <div className="space-y-1">
                {uploadedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-[10px] text-purple-700"
                  >
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {f.name}
                  </div>
                ))}
                <p className="text-[10px] text-purple-500 mt-1">
                  + 추가 자료 업로드
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[10px] text-purple-600">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> 프로필 +20%
                </span>
                <span>PDF/이미지</span>
              </div>
            )}
          </button>
        </div>

        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">라운드 진행</p>
          <div className="space-y-2">
            {ROUND_CONFIG.map((rc) => {
              const Icon = rc.icon;
              const isActive = currentRound === rc.num;
              const isDone = currentRound > rc.num;
              return (
                <div
                  key={rc.num}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    isActive ? "bg-blue-50 border border-blue-200" : isDone ? "bg-green-50" : "opacity-50"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    isDone ? "bg-green-100 text-green-600" : isActive ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
                  }`}>
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${isActive ? "text-blue-700" : isDone ? "text-green-700" : "text-gray-500"}`}>
                      R{rc.num}. {rc.label}
                    </p>
                    {isActive && <p className="text-[10px] text-blue-500">진행 중...</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">수집 통계</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-lg font-bold text-blue-600">{answeredCount}</p>
              <p className="text-[10px] text-blue-500">답변 완료</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <p className="text-lg font-bold text-green-600">{collectedDataCount}</p>
              <p className="text-[10px] text-green-500">확보 데이터</p>
            </div>
          </div>
          {uploadedFiles.length > 0 && (
            <div className="mt-2 rounded-lg bg-purple-50 p-3 text-center">
              <p className="text-lg font-bold text-purple-600">{uploadedFiles.length}</p>
              <p className="text-[10px] text-purple-500">첨부 자료</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">사업계획서 품질 기준</p>
          {[
            { label: "80%+", desc: "고품질 사업계획서 자동작성", color: "bg-green-500" },
            { label: "60~79%", desc: "기본 사업계획서 작성 가능", color: "bg-yellow-500" },
            { label: "60% 미만", desc: "추가 인터뷰 필요", color: "bg-red-500" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className={`mt-1.5 h-2 w-2 rounded-full ${item.color}`} />
              <div>
                <p className="text-xs font-medium text-gray-700">{item.label}</p>
                <p className="text-[10px] text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-indigo-600" />
            <p className="text-xs font-medium text-indigo-800">AI 전략 코칭</p>
          </div>
          <p className="text-xs text-indigo-700">
            {currentRound <= 2
              ? "시장 트렌드와 사업 핵심을 파악하고 있습니다. 수치와 데이터를 최대한 구체적으로 답변해 주세요."
              : currentRound <= 4
              ? "사업의 실행력과 성장 가능성을 확인하고 있습니다. 에비던스(실적, 인증, 투자)가 핵심입니다."
              : "마무리 단계입니다. 사회적 가치와 지원사업 적합성을 최적화하고 있습니다."}
          </p>
        </div>
      </div>
    </div>
  );
}
