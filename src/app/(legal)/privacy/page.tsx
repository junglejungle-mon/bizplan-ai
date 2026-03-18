import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | BizPlan AI",
  description: "BizPlan AI 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
              BP
            </div>
            <span className="text-lg font-bold">
              BizPlan <span className="text-blue-600">AI</span>
            </span>
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            홈으로
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
        <p className="text-sm text-gray-500 mb-10">시행일: 2026년 2월 13일 | 최종 수정: 2026년 2월 13일</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed">
          <p className="text-gray-600">
            주식회사 정글몬스터(이하 &quot;회사&quot;)는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고
            이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
          </p>

          <Section title="제1조 (수집하는 개인정보 항목)">
            <p className="mb-2">회사는 서비스 제공을 위해 다음 개인정보를 수집합니다.</p>
            <table className="w-full border-collapse border border-gray-200 text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 p-2 text-left">구분</th>
                  <th className="border border-gray-200 p-2 text-left">수집 항목</th>
                  <th className="border border-gray-200 p-2 text-left">수집 목적</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 p-2">필수</td>
                  <td className="border border-gray-200 p-2">이름, 이메일 주소, 비밀번호(암호화)</td>
                  <td className="border border-gray-200 p-2">회원가입, 본인 확인, 서비스 제공</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 p-2">선택</td>
                  <td className="border border-gray-200 p-2">전화번호, 기업명, 업종, 사업자등록번호</td>
                  <td className="border border-gray-200 p-2">알림 발송, 맞춤형 서비스 제공, 사업계획서 작성</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 p-2">자동 수집</td>
                  <td className="border border-gray-200 p-2">접속 로그, 서비스 이용 기록, IP 주소</td>
                  <td className="border border-gray-200 p-2">서비스 개선, 통계 분석, 부정 이용 방지</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 p-2">결제 시</td>
                  <td className="border border-gray-200 p-2">결제 수단 정보(카드사, 승인번호 등)</td>
                  <td className="border border-gray-200 p-2">결제 처리, 환불 처리 (포트원을 통해 처리)</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 p-2">소셜 로그인</td>
                  <td className="border border-gray-200 p-2">소셜 계정 이메일, 닉네임, 프로필 이미지</td>
                  <td className="border border-gray-200 p-2">간편 로그인, 본인 확인</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="제2조 (개인정보의 수집 방법)">
            <ol className="list-decimal list-inside space-y-1">
              <li>회원가입 및 서비스 이용 과정에서 이용자가 직접 입력</li>
              <li>소셜 로그인(Google, 카카오) 연동 시 제공 동의를 통해 수집</li>
              <li>서류 업로드(사업자등록증 OCR) 시 이용자가 제공</li>
              <li>서비스 이용 과정에서 쿠키, 접속 로그 등 자동 생성/수집</li>
            </ol>
          </Section>

          <Section title="제3조 (개인정보의 보유 및 이용 기간)">
            <ol className="list-decimal list-inside space-y-1">
              <li>회원 탈퇴 시까지 보유하며, 탈퇴 즉시 파기합니다.</li>
              <li>단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>계약 또는 청약철회 기록: 5년 (전자상거래법)</li>
                  <li>대금결제 및 재화 공급 기록: 5년 (전자상거래법)</li>
                  <li>소비자 불만 또는 분쟁 처리 기록: 3년 (전자상거래법)</li>
                  <li>접속 로그: 3개월 (통신비밀보호법)</li>
                </ul>
              </li>
            </ol>
          </Section>

          <Section title="제4조 (개인정보의 제3자 제공)">
            <ol className="list-decimal list-inside space-y-1">
              <li>회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.</li>
              <li>단, 다음의 경우 예외로 합니다.
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>이용자가 사전에 동의한 경우</li>
                  <li>법령에 의거하여 요구되는 경우</li>
                </ul>
              </li>
            </ol>
          </Section>

          <Section title="제5조 (개인정보 처리 위탁)">
            <p className="mb-2">회사는 서비스 제공을 위해 다음과 같이 개인정보를 위탁하고 있습니다.</p>
            <table className="w-full border-collapse border border-gray-200 text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 p-2 text-left">수탁업체</th>
                  <th className="border border-gray-200 p-2 text-left">위탁 업무</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-200 p-2">Supabase Inc.</td>
                  <td className="border border-gray-200 p-2">데이터베이스 호스팅 및 인증 서비스</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 p-2">주식회사 포트원</td>
                  <td className="border border-gray-200 p-2">결제 처리 및 결제 정보 관리</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 p-2">Anthropic</td>
                  <td className="border border-gray-200 p-2">AI 기반 콘텐츠 생성 처리</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 p-2">Vercel Inc.</td>
                  <td className="border border-gray-200 p-2">웹 서비스 호스팅</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="제6조 (개인정보의 파기)">
            <ol className="list-decimal list-inside space-y-1">
              <li>보유 기간이 경과하거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다.</li>
              <li>전자적 파일 형태: 복원 불가능한 방법으로 삭제</li>
              <li>종이 문서: 분쇄 또는 소각</li>
            </ol>
          </Section>

          <Section title="제7조 (이용자의 권리 및 행사 방법)">
            <p>이용자는 다음 권리를 행사할 수 있습니다.</p>
            <ol className="list-decimal list-inside space-y-1 mt-2">
              <li>개인정보 열람 요구</li>
              <li>개인정보 정정·삭제 요구</li>
              <li>개인정보 처리 정지 요구</li>
              <li>회원 탈퇴 (서비스 내 설정 페이지에서 직접 처리 가능)</li>
            </ol>
            <p className="mt-2">
              권리 행사는 서비스 내 설정 페이지 또는 이메일(support@bizplan-ai.kr)로 가능하며,
              요청 접수 후 10일 이내에 처리합니다.
            </p>
          </Section>

          <Section title="제8조 (개인정보의 안전성 확보 조치)">
            <p>회사는 다음과 같은 조치를 통해 개인정보의 안전성을 확보합니다.</p>
            <ol className="list-decimal list-inside space-y-1 mt-2">
              <li>비밀번호 암호화 저장 (bcrypt)</li>
              <li>SSL/TLS를 통한 데이터 전송 암호화</li>
              <li>접근 권한 제한 및 관리</li>
              <li>개인정보 접근 로그 관리</li>
              <li>Row Level Security(RLS)를 통한 데이터 접근 제어</li>
            </ol>
          </Section>

          <Section title="제9조 (쿠키의 사용)">
            <ol className="list-decimal list-inside space-y-1">
              <li>회사는 이용자의 편의를 위해 쿠키를 사용합니다.</li>
              <li>쿠키는 로그인 유지, 서비스 이용 분석 등의 목적으로 사용됩니다.</li>
              <li>이용자는 브라우저 설정을 통해 쿠키 허용/거부를 선택할 수 있습니다.</li>
              <li>쿠키를 거부할 경우 일부 서비스 이용에 제한이 있을 수 있습니다.</li>
            </ol>
          </Section>

          <Section title="제10조 (개인정보 보호책임자)">
            <table className="w-full border-collapse border border-gray-200 text-xs">
              <tbody>
                <tr>
                  <td className="border border-gray-200 p-2 bg-gray-50 font-medium w-32">성명</td>
                  <td className="border border-gray-200 p-2">정광우</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 p-2 bg-gray-50 font-medium">직위</td>
                  <td className="border border-gray-200 p-2">대표이사 (개인정보 보호책임자)</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 p-2 bg-gray-50 font-medium">연락처</td>
                  <td className="border border-gray-200 p-2">support@bizplan-ai.kr</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3">
              개인정보 침해에 대한 신고나 상담이 필요한 경우 다음 기관에 문의하시기 바랍니다.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>개인정보분쟁조정위원회: (국번없이) 1833-6972 (www.kopico.go.kr)</li>
              <li>개인정보침해신고센터: (국번없이) 118 (privacy.kisa.or.kr)</li>
              <li>대검찰청 사이버수사과: (국번없이) 1301 (www.spo.go.kr)</li>
              <li>경찰청 사이버수사국: (국번없이) 182 (ecrm.police.go.kr)</li>
            </ul>
          </Section>

          <Section title="제11조 (방침 변경)">
            <ol className="list-decimal list-inside space-y-1">
              <li>이 개인정보처리방침은 법령, 정책, 보안기술의 변경에 따라 수정될 수 있습니다.</li>
              <li>변경 시 서비스 내 공지사항을 통해 7일 전에 고지합니다.</li>
            </ol>
          </Section>

          <Section title="부칙">
            <p>이 개인정보처리방침은 2026년 2월 13일부터 시행됩니다.</p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200">
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-gray-700 underline">이용약관</Link>
            <Link href="/" className="hover:text-gray-700 underline">홈으로 돌아가기</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-600">{children}</div>
    </section>
  );
}
