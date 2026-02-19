import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 | BizPlan AI",
  description: "BizPlan AI 서비스 이용약관",
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">이용약관</h1>
        <p className="text-sm text-gray-500 mb-10">시행일: 2026년 2월 13일 | 최종 수정: 2026년 2월 13일</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed">
          <Section title="제1조 (목적)">
            <p>
              이 약관은 주식회사 정글몬스터(이하 &quot;회사&quot;)가 제공하는 BizPlan AI 서비스(이하 &quot;서비스&quot;)의 이용과 관련하여
              회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </Section>

          <Section title="제2조 (정의)">
            <ol className="list-decimal list-inside space-y-1">
              <li>&quot;서비스&quot;란 회사가 제공하는 AI 기반 사업계획서 작성, 정부지원사업 매칭, IR 자료 생성 등의 온라인 서비스를 말합니다.</li>
              <li>&quot;이용자&quot;란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 자를 말합니다.</li>
              <li>&quot;회원&quot;이란 회사에 개인정보를 제공하여 회원등록을 한 자로서, 서비스를 이용하는 자를 말합니다.</li>
              <li>&quot;유료 서비스&quot;란 회사가 유료로 제공하는 각종 서비스를 말합니다.</li>
            </ol>
          </Section>

          <Section title="제3조 (약관의 효력 및 변경)">
            <ol className="list-decimal list-inside space-y-1">
              <li>이 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
              <li>회사는 관련 법률에 위배되지 않는 범위에서 이 약관을 개정할 수 있습니다.</li>
              <li>개정 약관은 적용일 7일 전부터 서비스 내 공지사항을 통해 고지합니다.</li>
            </ol>
          </Section>

          <Section title="제4조 (회원가입 및 이용계약)">
            <ol className="list-decimal list-inside space-y-1">
              <li>이용자가 약관에 동의하고 회원가입을 완료하면 이용계약이 성립됩니다.</li>
              <li>회사는 다음 각 호에 해당하는 경우 회원가입을 거절할 수 있습니다.
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>타인의 정보를 이용하여 가입한 경우</li>
                  <li>필수 정보를 허위로 기재한 경우</li>
                  <li>기타 회원으로 등록하는 것이 서비스 운영에 현저한 지장을 초래하는 경우</li>
                </ul>
              </li>
            </ol>
          </Section>

          <Section title="제5조 (서비스의 내용)">
            <p>회사는 다음과 같은 서비스를 제공합니다.</p>
            <ol className="list-decimal list-inside space-y-1 mt-2">
              <li>AI 기반 사업계획서 자동 작성 서비스</li>
              <li>정부지원사업 매칭 및 추천 서비스</li>
              <li>IR(투자유치) 자료 생성 서비스</li>
              <li>서류 관리 및 OCR 인식 서비스</li>
              <li>AI 비서(챗봇) 상담 서비스</li>
              <li>기타 회사가 추가 개발하여 제공하는 서비스</li>
            </ol>
          </Section>

          <Section title="제6조 (서비스의 변경 및 중단)">
            <ol className="list-decimal list-inside space-y-1">
              <li>회사는 운영상, 기술상의 필요에 따라 서비스를 변경할 수 있습니다.</li>
              <li>천재지변, 시스템 장애 등 불가항력적 사유가 있는 경우 서비스를 일시 중단할 수 있습니다.</li>
              <li>서비스 변경 시 7일 전에 공지합니다. 단, 긴급한 경우 사후 공지할 수 있습니다.</li>
            </ol>
          </Section>

          <Section title="제7조 (유료 서비스 및 결제)">
            <ol className="list-decimal list-inside space-y-1">
              <li>유료 서비스의 종류, 이용요금, 결제방법 등은 서비스 내 요금제 페이지에 별도로 게시합니다.</li>
              <li>결제는 신용카드, 체크카드, 카카오페이, 네이버페이, 토스페이를 통해 처리됩니다.</li>
              <li>결제는 PortOne(포트원)을 통해 안전하게 처리되며, 회사는 결제 정보를 직접 보관하지 않습니다.</li>
              <li>월 구독 서비스의 경우, 이용기간 만료 시 자동으로 갱신됩니다.</li>
            </ol>
          </Section>

          <Section title="제8조 (환불 정책)">
            <ol className="list-decimal list-inside space-y-1">
              <li>결제 후 7일 이내에 서비스를 이용하지 않은 경우, 전액 환불이 가능합니다.</li>
              <li>서비스를 이용한 경우(사업계획서 생성, IR 자료 생성 등), 이용 비율에 따라 부분 환불이 가능합니다.</li>
              <li>환불 신청은 서비스 내 설정 페이지 또는 고객센터(support@bizplan-ai.kr)를 통해 가능합니다.</li>
              <li>환불은 신청일로부터 영업일 기준 3~5일 이내에 처리됩니다.</li>
              <li>구독 취소 시 현재 결제 기간이 끝날 때까지 서비스를 이용할 수 있으며, 이후 무료 플랜으로 자동 전환됩니다.</li>
            </ol>
          </Section>

          <Section title="제9조 (이용자의 의무)">
            <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
            <ol className="list-decimal list-inside space-y-1 mt-2">
              <li>타인의 정보를 도용하는 행위</li>
              <li>회사의 지식재산권을 침해하는 행위</li>
              <li>서비스를 이용하여 법령에 위반되는 행위를 하는 것</li>
              <li>서비스의 안정적 운영을 방해하는 행위</li>
              <li>AI가 생성한 콘텐츠를 허위 사실로 유포하는 행위</li>
            </ol>
          </Section>

          <Section title="제10조 (AI 생성 콘텐츠의 책임)">
            <ol className="list-decimal list-inside space-y-1">
              <li>서비스가 AI를 통해 생성하는 사업계획서, IR 자료 등은 참고 자료로서 제공됩니다.</li>
              <li>AI 생성 콘텐츠의 정확성, 완전성, 적합성을 보장하지 않으며, 최종 내용에 대한 책임은 이용자에게 있습니다.</li>
              <li>정부지원사업 신청, 투자유치 등에 활용할 경우 반드시 내용을 검토하고 보완하시기 바랍니다.</li>
            </ol>
          </Section>

          <Section title="제11조 (지식재산권)">
            <ol className="list-decimal list-inside space-y-1">
              <li>서비스에 관한 저작권 및 지식재산권은 회사에 귀속됩니다.</li>
              <li>이용자가 서비스를 통해 생성한 사업계획서, IR 자료 등의 콘텐츠에 대한 권리는 이용자에게 귀속됩니다.</li>
              <li>이용자는 서비스를 이용하여 생성한 콘텐츠를 자유롭게 활용할 수 있습니다.</li>
            </ol>
          </Section>

          <Section title="제12조 (회원 탈퇴 및 자격 상실)">
            <ol className="list-decimal list-inside space-y-1">
              <li>회원은 언제든지 서비스 내 설정에서 탈퇴를 요청할 수 있으며, 회사는 즉시 처리합니다.</li>
              <li>탈퇴 시 회원의 개인정보 및 서비스 이용 기록은 개인정보처리방침에 따라 처리됩니다.</li>
              <li>유료 서비스 이용 중 탈퇴 시, 남은 이용기간에 대한 환불은 제8조에 따릅니다.</li>
            </ol>
          </Section>

          <Section title="제13조 (손해배상)">
            <ol className="list-decimal list-inside space-y-1">
              <li>회사는 무료로 제공하는 서비스와 관련하여 이용자에게 발생한 손해에 대해 책임을 부담하지 않습니다.</li>
              <li>회사의 귀책사유로 유료 서비스 이용자에게 손해가 발생한 경우, 해당 유료 서비스 결제 금액을 한도로 배상합니다.</li>
            </ol>
          </Section>

          <Section title="제14조 (분쟁 해결)">
            <ol className="list-decimal list-inside space-y-1">
              <li>서비스 이용으로 인한 분쟁은 우선 당사자 간 협의로 해결합니다.</li>
              <li>협의가 이루어지지 않는 경우, 관할 법원은 회사의 본사 소재지 관할 법원으로 합니다.</li>
              <li>서비스 관련 분쟁에 대해 한국소비자원, 전자거래분쟁조정위원회 등에 조정을 신청할 수 있습니다.</li>
            </ol>
          </Section>

          <Section title="부칙">
            <p>이 약관은 2026년 2월 13일부터 시행됩니다.</p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200">
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-gray-700 underline">개인정보처리방침</Link>
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
