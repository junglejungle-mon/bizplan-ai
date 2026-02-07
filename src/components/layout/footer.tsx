import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
                BP
              </div>
              <span className="text-lg font-bold">
                BizPlan <span className="text-blue-600">AI</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              AI가 정부지원사업을 찾고,<br />
              사업계획서까지 자동으로 써주는 서비스
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">서비스</h3>
            <ul className="mt-3 space-y-2">
              <li><Link href="/programs" className="text-sm text-gray-500 hover:text-gray-700">지원사업 매칭</Link></li>
              <li><Link href="/plans" className="text-sm text-gray-500 hover:text-gray-700">사업계획서 작성</Link></li>
              <li><Link href="/documents" className="text-sm text-gray-500 hover:text-gray-700">서류관리</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">지원</h3>
            <ul className="mt-3 space-y-2">
              <li><Link href="#" className="text-sm text-gray-500 hover:text-gray-700">이용약관</Link></li>
              <li><Link href="#" className="text-sm text-gray-500 hover:text-gray-700">개인정보처리방침</Link></li>
              <li><Link href="#" className="text-sm text-gray-500 hover:text-gray-700">문의하기</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900">연락처</h3>
            <ul className="mt-3 space-y-2">
              <li className="text-sm text-gray-500">support@bizplan-ai.kr</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-8">
          <p className="text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} BizPlan AI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
