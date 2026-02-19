# BizPlan AI

AI가 정부지원사업을 찾고 사업계획서까지 써주는 서비스

**https://bizplanai.co.kr**

## 주요 기능

- **정부지원사업 AI 매칭** — 기업 정보 기반으로 적합한 지원사업 자동 추천
- **사업계획서 자동 작성** — Claude AI 기반 섹션별 사업계획서 생성
- **IR PPT 생성** — 투자 유치용 프레젠테이션 자동 생성
- **HWPX/DOCX/PDF 내보내기** — 정부 양식에 맞는 문서 변환
- **AI 컨설턴트** — 사업계획서 품질 점검 및 개선 제안

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) + React 19 |
| 언어 | TypeScript |
| AI | Claude (Anthropic), Perplexity (리서치) |
| DB/인증 | Supabase (PostgreSQL + Auth) |
| 결제 | PortOne V2 (토스페이먼츠) |
| 배포 | Vercel |
| 모니터링 | Sentry |
| 문서 생성 | docx, jsPDF, JSZip (HWPX), pptxgenjs |

## 시작하기

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env.local
# .env.local에 Supabase, Anthropic 등 API 키 입력

# 개발 서버 실행
npm run dev

# Claude 로컬 프록시 + 개발 서버 동시 실행
npm run dev:local
```

http://localhost:3000 에서 확인

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # 로그인, 회원가입, 비밀번호 리셋
│   ├── (dashboard)/        # 사용자 대시보드
│   │   ├── company/        # 기업 정보 관리
│   │   ├── plans/          # 사업계획서
│   │   ├── programs/       # 정부지원사업 목록
│   │   ├── ir/             # IR PPT
│   │   ├── consultant/     # AI 컨설턴트
│   │   ├── documents/      # 문서 관리
│   │   ├── scheduler/      # 일정 관리
│   │   └── pricing/        # 요금제
│   ├── admin/              # 관리자 패널
│   ├── api/                # API 라우트
│   ├── (legal)/            # 약관, 개인정보처리방침
│   ├── faq/                # FAQ
│   └── contact/            # 문의
├── components/             # 공용 컴포넌트
├── lib/                    # 핵심 라이브러리
│   ├── pipeline/           # AI 사업계획서 생성 파이프라인
│   ├── hwpx/               # HWPX 파싱/생성
│   ├── payment/            # 결제/구독 관리
│   ├── quality/            # 품질 평가
│   ├── notification/       # 알림 (Solapi)
│   └── supabase/           # DB 클라이언트
└── middleware.ts            # 인증 미들웨어
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 |
| `npm run dev:local` | Claude 프록시 + 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm test` | 테스트 실행 |
| `npm run test:coverage` | 테스트 커버리지 |

## 환경변수

`.env.example` 참고. 필수 환경변수:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase 서버 전용
- `ANTHROPIC_API_KEY` — Claude AI (또는 `AI_MODE=local` + `CLAUDE_PROXY_URL`)
- `ADMIN_PASSWORD` — 관리자 패널 접근

## 라이선스

Private — (주)정글몬스터
