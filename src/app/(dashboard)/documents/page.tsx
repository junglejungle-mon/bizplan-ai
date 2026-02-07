import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  Upload,
  CheckCircle2,
} from "lucide-react";

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

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect("/onboarding");

  const { data: documents } = await supabase
    .from("company_documents")
    .select("*")
    .eq("company_id", company.id);

  const uploadedTypes = new Set(
    (documents ?? []).map((d: any) => d.document_type)
  );
  const totalDocs = DOCUMENT_CATEGORIES.reduce(
    (sum, cat) => sum + cat.documents.length,
    0
  );
  const linkedDocs = uploadedTypes.size;
  const level = Math.min(5, Math.floor(linkedDocs / 2) + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">서류관리</h1>
        <p className="text-gray-500">
          서류를 연동하면 사업계획서 품질이 향상됩니다
        </p>
      </div>

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
              홈택스 재무제표를 연동하면 무료 사업계획서 1건이 제공됩니다!
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
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {category.documents.map((doc) => {
                const isUploaded = uploadedTypes.has(doc.type);
                return (
                  <div
                    key={doc.type}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {isUploaded ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                      )}
                      <span
                        className={`text-sm ${
                          isUploaded ? "text-gray-900" : "text-gray-500"
                        }`}
                      >
                        {doc.name}
                      </span>
                    </div>
                    {!isUploaded && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                      >
                        <Upload className="h-3 w-3" /> 업로드
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 인센티브 안내 */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">연동 인센티브</h3>
          <div className="space-y-3">
            {[
              {
                level: 1,
                item: "AI 인터뷰 완료 (프로필 70%+)",
                reward: "매칭 서비스 이용 가능",
              },
              {
                level: 2,
                item: "+ 사업자등록증 업로드",
                reward: "매칭 정확도 향상",
              },
              {
                level: 3,
                item: "+ 홈택스 재무제표 연동",
                reward: "무료 사업계획서 1건",
              },
              {
                level: 4,
                item: "+ 중소벤처24 인증서 연동",
                reward: "사업계획서 품질 '상' 등급",
              },
              {
                level: 5,
                item: "+ 전체 서류 연동 (11종)",
                reward: "무료 IR PPT 1건 + 프리미엄 1주",
              },
            ].map((item) => (
              <div
                key={item.level}
                className={`flex items-center justify-between rounded-lg p-3 ${
                  level >= item.level ? "bg-green-50" : "bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={level >= item.level ? "success" : "outline"}
                  >
                    Lv.{item.level}
                  </Badge>
                  <span className="text-sm">{item.item}</span>
                </div>
                <span
                  className={`text-sm font-medium ${
                    level >= item.level
                      ? "text-green-600"
                      : "text-gray-400"
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
