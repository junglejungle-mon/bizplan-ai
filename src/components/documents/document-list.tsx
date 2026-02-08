"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen,
  CheckCircle2,
  FileText,
  Eye,
} from "lucide-react";
import { DocumentUploadButton } from "./document-upload-button";
import { useState } from "react";

const DOCUMENT_CATEGORIES = [
  {
    source: "hometax",
    name: "홈택스",
    documents: [
      { type: "tax_clearance", name: "국세완납증명서" },
      { type: "biz_registration", name: "사업자등록증명" },
      { type: "tax_payment", name: "납부내역증명(납세사실증명)" },
      { type: "vat_certificate", name: "부가가치세 과세표준증명원" },
      { type: "financial_statement", name: "표준재무제표증명" },
    ],
  },
  {
    source: "mss",
    name: "중소벤처24",
    documents: [
      { type: "venture_cert", name: "벤처기업확인서" },
      { type: "sme_cert", name: "중소기업(소상공인)확인서" },
      { type: "women_cert", name: "여성기업확인서" },
      { type: "startup_cert", name: "창업기업확인서" },
    ],
  },
  {
    source: "insurance",
    name: "사회보험",
    documents: [
      { type: "insurance_clearance", name: "4대보험 완납증명서" },
      { type: "insurance_members", name: "4대보험 가입자명부" },
    ],
  },
];

interface DocumentInfo {
  id: string;
  document_type: string;
  status: string;
  extracted_data: any;
  file_url: string | null;
}

interface DocumentListProps {
  documents: DocumentInfo[];
}

export function DocumentList({ documents }: DocumentListProps) {
  const [selectedDoc, setSelectedDoc] = useState<DocumentInfo | null>(null);

  const uploadedMap = new Map<string, DocumentInfo>();
  for (const d of documents) {
    uploadedMap.set(d.document_type, d);
  }

  const totalDocs = DOCUMENT_CATEGORIES.reduce(
    (sum, cat) => sum + cat.documents.length,
    0
  );
  const linkedDocs = uploadedMap.size;
  const level = Math.min(5, Math.floor(linkedDocs / 2) + 1);

  return (
    <div className="space-y-6">
      {/* 연동 현황 */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-blue-900">
                데이터 연동 현황
              </h3>
              <p className="text-sm text-blue-700">
                Level {level}/5 — {linkedDocs}/{totalDocs}종 연동
              </p>
            </div>
            <Badge variant="default">Level {level}</Badge>
          </div>
          <div className="h-3 rounded-full bg-blue-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
              style={{ width: `${(linkedDocs / totalDocs) * 100}%` }}
            />
          </div>
          {level < 3 && (
            <p className="mt-3 text-xs text-blue-600">
              💡 홈택스 재무제표를 연동하면 무료 사업계획서 1건이 제공됩니다!
            </p>
          )}
          {level >= 3 && level < 5 && (
            <p className="mt-3 text-xs text-green-600">
              ✅ 무료 사업계획서 1건 혜택이 활성화되었습니다!
            </p>
          )}
          {level >= 5 && (
            <p className="mt-3 text-xs text-indigo-600">
              🎉 전체 연동 완료! 무료 IR PPT 1건 + 프리미엄 1주 혜택 활성화!
            </p>
          )}
        </CardContent>
      </Card>

      {/* 서류 카테고리 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {DOCUMENT_CATEGORIES.map((category) => (
          <Card key={category.source}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-blue-600" />
                {category.name}
                <Badge variant="outline" className="ml-auto text-xs">
                  {category.documents.filter((d) => uploadedMap.has(d.type)).length}/
                  {category.documents.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {category.documents.map((doc) => {
                const uploaded = uploadedMap.get(doc.type);
                const isUploaded = !!uploaded;
                const isExtracted = uploaded?.status === "extracted";

                return (
                  <div
                    key={doc.type}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isExtracted ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : isUploaded ? (
                        <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                      )}
                      <span
                        className={`text-sm truncate ${
                          isExtracted
                            ? "text-green-700 font-medium"
                            : isUploaded
                            ? "text-blue-700"
                            : "text-gray-500"
                        }`}
                      >
                        {doc.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isExtracted && uploaded?.extracted_data && (
                        <button
                          onClick={() => setSelectedDoc(uploaded)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                      )}
                      {!isUploaded && (
                        <DocumentUploadButton
                          documentType={doc.type}
                          source={category.source}
                          documentName={doc.name}
                        />
                      )}
                      {isUploaded && !isExtracted && uploaded?.status === "processing" && (
                        <span className="text-xs text-amber-600">분석중...</span>
                      )}
                      {isUploaded && !isExtracted && uploaded?.status === "error" && (
                        <span className="text-xs text-red-600">오류</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 추출 데이터 미리보기 모달 */}
      {selectedDoc && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-900 mb-4">
              추출된 데이터
            </h3>
            <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(selectedDoc.extracted_data, null, 2)}
            </pre>
            <button
              onClick={() => setSelectedDoc(null)}
              className="mt-4 w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 인센티브 안내 */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">연동 인센티브</h3>
          <div className="space-y-3">
            {[
              {
                lv: 1,
                item: "AI 인터뷰 완료 (프로필 70%+)",
                reward: "매칭 서비스 이용 가능",
              },
              {
                lv: 2,
                item: "+ 사업자등록증 업로드",
                reward: "매칭 정확도 향상",
              },
              {
                lv: 3,
                item: "+ 홈택스 재무제표 연동",
                reward: "무료 사업계획서 1건 🎁",
              },
              {
                lv: 4,
                item: "+ 중소벤처24 인증서 연동",
                reward: "사업계획서 품질 '상' 등급",
              },
              {
                lv: 5,
                item: "+ 전체 서류 연동 (11종)",
                reward: "무료 IR PPT 1건 + 프리미엄 1주 🎁",
              },
            ].map((item) => (
              <div
                key={item.lv}
                className={`flex items-center justify-between rounded-lg p-3 ${
                  level >= item.lv ? "bg-green-50" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={level >= item.lv ? "success" : "outline"}
                  >
                    Lv.{item.lv}
                  </Badge>
                  <span className="text-sm">{item.item}</span>
                </div>
                <span
                  className={`text-sm font-medium ${
                    level >= item.lv ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {item.reward}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
