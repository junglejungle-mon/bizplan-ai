"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── FAQ 데이터 ──

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
  order: number;
}

const FAQ_CATEGORIES = [
  { value: "general", label: "일반" },
  { value: "payment", label: "결제/구독" },
  { value: "plan", label: "사업계획서" },
  { value: "matching", label: "매칭" },
  { value: "account", label: "계정" },
];

const DEFAULT_FAQS: FAQ[] = [
  {
    id: "1", category: "general", order: 1,
    question: "BizPlan AI는 어떤 서비스인가요?",
    answer: "BizPlan AI는 AI 기반 사업계획서 자동 작성 및 정부지원사업 매칭 플랫폼입니다. 기업 정보를 입력하면 맞춤형 사업계획서를 생성하고, 적합한 정부지원사업을 자동으로 매칭해드립니다.",
  },
  {
    id: "2", category: "general", order: 2,
    question: "무료로 이용할 수 있나요?",
    answer: "네, 무료 플랜으로 매월 사업계획서 1건을 작성하실 수 있습니다. 더 많은 기능이 필요하시면 프로 또는 올프리 플랜을 이용해보세요.",
  },
  {
    id: "3", category: "payment", order: 1,
    question: "결제 수단은 무엇이 있나요?",
    answer: "카카오페이, 네이버페이, 토스페이, 신용카드/체크카드 등 다양한 결제 수단을 지원합니다.",
  },
  {
    id: "4", category: "payment", order: 2,
    question: "구독을 취소하면 어떻게 되나요?",
    answer: "구독 취소 시 현재 결제 기간이 끝날 때까지 서비스를 이용하실 수 있습니다. 기간 만료 후 무료 플랜으로 자동 전환됩니다.",
  },
  {
    id: "5", category: "payment", order: 3,
    question: "환불이 가능한가요?",
    answer: "결제 후 7일 이내에 서비스를 이용하지 않은 경우 전액 환불이 가능합니다. 고객센터로 문의해주세요.",
  },
  {
    id: "6", category: "plan", order: 1,
    question: "사업계획서 작성에 얼마나 걸리나요?",
    answer: "기업 정보가 충분히 입력되어 있다면 약 3~5분 내에 초안이 생성됩니다. 이후 섹션별 수정 및 재생성이 가능합니다.",
  },
  {
    id: "7", category: "plan", order: 2,
    question: "작성된 사업계획서를 수정할 수 있나요?",
    answer: "네, 생성된 사업계획서의 각 섹션을 직접 편집하거나 AI에게 재생성을 요청할 수 있습니다. 프로 플랜에서는 무제한 재생성이 가능합니다.",
  },
  {
    id: "8", category: "matching", order: 1,
    question: "프로그램 매칭은 어떻게 작동하나요?",
    answer: "기업 정보(업종, 규모, 지역 등)를 기반으로 AI가 적합한 정부지원사업을 자동으로 찾아 매칭해드립니다. 매칭 점수와 함께 지원 가능성을 안내해드립니다.",
  },
  {
    id: "9", category: "account", order: 1,
    question: "기업 정보를 변경하고 싶어요.",
    answer: "설정 > 기업 정보에서 언제든 수정하실 수 있습니다. 기업 정보가 정확할수록 더 나은 매칭과 사업계획서를 받으실 수 있습니다.",
  },
  {
    id: "10", category: "account", order: 2,
    question: "회원 탈퇴는 어떻게 하나요?",
    answer: "설정 > 계정에서 회원 탈퇴를 신청하실 수 있습니다. 탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다. 활성 구독이 있는 경우 먼저 취소해주세요.",
  },
];

// ── 자동응답 템플릿 ──

interface AutoReply {
  id: string;
  trigger: string;
  response: string;
  isActive: boolean;
}

const DEFAULT_AUTO_REPLIES: AutoReply[] = [
  {
    id: "ar1", trigger: "환불", isActive: true,
    response: "환불 관련 문의 감사합니다. 결제 후 7일 이내에 서비스를 이용하지 않은 경우 전액 환불이 가능합니다. 상세 환불 정책은 이용약관을 확인해주세요. 환불 처리를 원하시면 '환불 신청'이라고 입력해주세요.",
  },
  {
    id: "ar2", trigger: "가격|요금|비용|플랜", isActive: true,
    response: "요금제 안내입니다.\n- 무료: 월 1건 사업계획서\n- 프로 (99,000원/월): 월 10건 + IR 5건 + 재생성 50회\n- 올프리 (299,000원/월): 무제한\n자세한 내용은 요금제 페이지를 확인해주세요.",
  },
  {
    id: "ar3", trigger: "오류|에러|안됨|작동", isActive: true,
    response: "불편을 드려 죄송합니다. 정확한 도움을 위해 다음 정보를 알려주세요.\n1. 어떤 기능에서 문제가 발생했나요?\n2. 화면에 표시된 오류 메시지가 있나요?\n3. 사용 중인 브라우저와 기기를 알려주세요.",
  },
  {
    id: "ar4", trigger: "취소|해지", isActive: true,
    response: "구독 취소를 원하시나요? 설정 > 구독 관리에서 직접 취소하실 수 있습니다. 취소 후에도 현재 결제 기간까지는 서비스 이용이 가능합니다. 도움이 필요하시면 알려주세요.",
  },
];

// ── Page Component ──

export default function AdminCSPage() {
  const [faqs, setFaqs] = useState<FAQ[]>(DEFAULT_FAQS);
  const [autoReplies, setAutoReplies] = useState<AutoReply[]>(DEFAULT_AUTO_REPLIES);
  const [activeTab, setActiveTab] = useState<"faq" | "auto" | "templates">("faq");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [editingFaq, setEditingFaq] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ question: string; answer: string; category: string }>({
    question: "", answer: "", category: "general",
  });
  const [addingFaq, setAddingFaq] = useState(false);

  const filteredFaqs = selectedCategory
    ? faqs.filter((f) => f.category === selectedCategory)
    : faqs;

  const handleSaveFaq = (id: string) => {
    setFaqs((prev) => prev.map((f) =>
      f.id === id ? { ...f, ...editForm } : f
    ));
    setEditingFaq(null);
  };

  const handleAddFaq = () => {
    const newFaq: FAQ = {
      id: `new-${Date.now()}`,
      category: editForm.category,
      question: editForm.question,
      answer: editForm.answer,
      order: faqs.length + 1,
    };
    setFaqs([...faqs, newFaq]);
    setAddingFaq(false);
    setEditForm({ question: "", answer: "", category: "general" });
  };

  const handleDeleteFaq = (id: string) => {
    if (!confirm("이 FAQ를 삭제하시겠습니까?")) return;
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleAutoReply = (id: string) => {
    setAutoReplies((prev) => prev.map((r) =>
      r.id === id ? { ...r, isActive: !r.isActive } : r
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CS 관리</h1>
          <p className="text-sm text-gray-500 mt-1">FAQ 관리 및 자동응답 설정</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { value: "faq" as const, label: "FAQ 관리" },
          { value: "auto" as const, label: "자동응답" },
          { value: "templates" as const, label: "응답 템플릿" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* FAQ 관리 탭 */}
      {activeTab === "faq" && (
        <div className="space-y-4">
          {/* 카테고리 필터 + 추가 */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button
                onClick={() => setSelectedCategory("")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  !selectedCategory ? "bg-blue-100 text-blue-700" : "bg-gray-50 text-gray-500"
                }`}
              >
                전체 ({faqs.length})
              </button>
              {FAQ_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                    selectedCategory === cat.value ? "bg-blue-100 text-blue-700" : "bg-gray-50 text-gray-500"
                  }`}
                >
                  {cat.label} ({faqs.filter((f) => f.category === cat.value).length})
                </button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={() => {
                setAddingFaq(true);
                setEditForm({ question: "", answer: "", category: "general" });
              }}
            >
              FAQ 추가
            </Button>
          </div>

          {/* 새 FAQ 추가 폼 */}
          {addingFaq && (
            <Card className="border-blue-200">
              <CardContent className="pt-4 space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">질문</label>
                    <input
                      type="text"
                      value={editForm.question}
                      onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                      className="w-full h-9 rounded-lg border px-3 text-sm"
                      placeholder="자주 묻는 질문을 입력하세요"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">카테고리</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="h-9 rounded-lg border px-2 text-sm"
                    >
                      {FAQ_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">답변</label>
                  <textarea
                    value={editForm.answer}
                    onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    rows={3}
                    placeholder="답변을 입력하세요"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddFaq} disabled={!editForm.question || !editForm.answer}>저장</Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingFaq(false)}>취소</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* FAQ 목록 */}
          <div className="space-y-2">
            {filteredFaqs.map((faq) => {
              const isEditing = editingFaq === faq.id;
              const catLabel = FAQ_CATEGORIES.find((c) => c.value === faq.category)?.label || faq.category;
              return (
                <Card key={faq.id} className={isEditing ? "border-blue-200" : ""}>
                  <CardContent className="pt-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editForm.question}
                          onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                          className="w-full h-9 rounded-lg border px-3 text-sm font-medium"
                        />
                        <textarea
                          value={editForm.answer}
                          onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveFaq(faq.id)}>저장</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingFaq(null)}>취소</Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-[10px]">{catLabel}</Badge>
                              <span className="font-medium text-gray-900 text-sm">{faq.question}</span>
                            </div>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap ml-0.5">{faq.answer}</p>
                          </div>
                          <div className="flex gap-1 ml-3 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7"
                              onClick={() => {
                                setEditingFaq(faq.id);
                                setEditForm({
                                  question: faq.question,
                                  answer: faq.answer,
                                  category: faq.category,
                                });
                              }}
                            >
                              편집
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 text-red-500"
                              onClick={() => handleDeleteFaq(faq.id)}
                            >
                              삭제
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 자동응답 탭 */}
      {activeTab === "auto" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            사용자 메시지에 특정 키워드가 포함되면 자동으로 응답합니다. 정규식 패턴을 사용할 수 있습니다.
          </p>
          {autoReplies.map((reply) => (
            <Card key={reply.id} className={reply.isActive ? "" : "opacity-60"}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={reply.isActive ? "success" : "secondary"} className="text-[10px]">
                        {reply.isActive ? "활성" : "비활성"}
                      </Badge>
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                        {reply.trigger}
                      </code>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{reply.response}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 ml-3"
                    onClick={() => toggleAutoReply(reply.id)}
                  >
                    {reply.isActive ? "비활성화" : "활성화"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 응답 템플릿 탭 */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            자주 사용하는 응답 문구를 템플릿으로 관리합니다. 클릭하면 클립보드에 복사됩니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "감사 인사", text: "문의해주셔서 감사합니다. 추가 궁금한 점이 있으시면 언제든 연락 주세요." },
              { title: "확인 필요", text: "확인 후 빠르게 답변 드리겠습니다. 영업일 기준 1~2일 내에 안내해드리겠습니다." },
              { title: "기술 지원 안내", text: "기술적인 문제가 지속되시면 support@bizplan-ai.com으로 스크린샷과 함께 상세 내용을 보내주세요." },
              { title: "업그레이드 안내", text: "현재 이용 중인 무료 플랜에서는 해당 기능이 제한됩니다. 프로 플랜 이상에서 이용 가능하며, 요금제 페이지에서 업그레이드하실 수 있습니다." },
              { title: "데이터 백업 안내", text: "사업계획서는 언제든 PDF로 내보내기하실 수 있습니다. 계획서 상세 페이지에서 '내보내기' 버튼을 이용해주세요." },
              { title: "문제 해결 후 안내", text: "해당 문제가 해결되었습니다. 동일한 문제가 다시 발생하면 알려주세요. 불편을 드려 죄송합니다." },
            ].map((tpl, i) => (
              <Card
                key={i}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => {
                  navigator.clipboard.writeText(tpl.text);
                  toast.success("클립보드에 복사되었습니다.");
                }}
              >
                <CardContent className="pt-4">
                  <h4 className="font-medium text-gray-900 text-sm mb-1">{tpl.title}</h4>
                  <p className="text-xs text-gray-600">{tpl.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
