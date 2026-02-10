# 카카오 알림톡 + 카카오 로그인 — 외부 설정 TODO

> 코드/DB/배포는 완료됨. 아래 3가지 외부 설정만 하면 동작함.

---

## 1. 카카오 개발자 앱 등록

**URL:** https://developers.kakao.com/console/app

1. 애플리케이션 추가하기 → 앱 이름: `BizPlan AI`
2. **앱 설정 > 플랫폼** → Web 도메인 추가:
   ```
   https://bizplan-ai-kappa.vercel.app
   ```
3. **카카오 로그인** → 활성화 ON
4. **카카오 로그인 > Redirect URI** 추가:
   ```
   https://kqzxcatjzerstldysboa.supabase.co/auth/v1/callback
   ```
5. **동의 항목** 설정:
   - 닉네임 (필수)
   - 카카오계정(이메일) (필수)
   - 전화번호 (선택 — 비즈앱 전환 후 가능)
6. **앱 키** 탭에서 복사:
   - **REST API 키** → Supabase `external_kakao_client_id`에 입력
   - **앱 설정 > 보안 > Client Secret** 생성 → Supabase `external_kakao_secret`에 입력

### Supabase에 적용하는 명령어 (값 받으면 실행)

```bash
export SUPABASE_ACCESS_TOKEN=sbp_30efd267194e1b7233ced53885b847d584cd8b64

curl -X PATCH \
  "https://api.supabase.com/v1/projects/kqzxcatjzerstldysboa/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "external_kakao_enabled": true,
    "external_kakao_client_id": "여기에_REST_API_키",
    "external_kakao_secret": "여기에_Client_Secret"
  }'
```

---

## 2. 솔라피(Solapi) 설정

**URL:** https://solapi.com

1. 회원가입 + 로그인
2. **발신번호 등록** (사업자 전화번호, 인증 필요)
3. **API Key / API Secret** 발급: 대시보드 > API 키 관리
4. **카카오톡 채널 연동**: 대시보드 > 카카오톡 > 채널 연동
   - 채널 프로필 ID (pfId) 확인

### 값 받으면 실행할 명령어

```bash
# .env.local 업데이트
# SOLAPI_API_KEY=실제값
# SOLAPI_API_SECRET=실제값
# SOLAPI_KAKAO_PF_ID=실제값
# SOLAPI_SENDER_PHONE=실제값

# Vercel 환경변수 업데이트 (기존 PLACEHOLDER 교체)
NODE_TLS_REJECT_UNAUTHORIZED=0 vercel env rm SOLAPI_API_KEY production -y
echo "실제값" | NODE_TLS_REJECT_UNAUTHORIZED=0 vercel env add SOLAPI_API_KEY production
# ... 나머지도 동일
```

---

## 3. 알림톡 템플릿 등록 (솔라피 대시보드)

**심사 소요: 3~7일**

### 템플릿 1: 매칭 결과
- 템플릿 이름: `bizplan_matching`
- 내용:
  ```
  #{회사명}님, 새로운 매칭 공고 #{매칭건수}건이 발견되었습니다.
  최고 적합도 #{최고점수}점

  ▶ 매칭 결과 확인하기
  ```
- 버튼: 웹링크 `https://bizplan-ai-kappa.vercel.app/programs`

### 템플릿 2: 마감 임박
- 템플릿 이름: `bizplan_deadline`
- 내용:
  ```
  #{공고명} 마감이 #{남은일수}일 남았습니다.

  지금 지원하지 않으면 놓칠 수 있습니다.

  ▶ 공고 확인하기
  ```
- 버튼: 웹링크 `https://bizplan-ai-kappa.vercel.app/programs`

### 템플릿 3: 사업계획서 완료
- 템플릿 이름: `bizplan_plan_complete`
- 내용:
  ```
  #{계획서명} AI 사업계획서 작성이 완료되었습니다.

  지금 바로 검토하고 다운로드하세요.

  ▶ 사업계획서 확인하기
  ```
- 버튼: 웹링크 `https://bizplan-ai-kappa.vercel.app/plans`

### 심사 통과 후 실행할 명령어

```bash
# 템플릿 ID를 .env.local + Vercel에 등록
# SOLAPI_TPL_MATCHING=심사통과된_템플릿ID
# SOLAPI_TPL_DEADLINE=심사통과된_템플릿ID
# SOLAPI_TPL_PLAN_COMPLETE=심사통과된_템플릿ID
```

---

## 완료 체크리스트

- [ ] 카카오 개발자 앱 등록
- [ ] 카카오 로그인 활성화 + Redirect URI
- [ ] Supabase Kakao provider 활성화
- [ ] 솔라피 가입 + API 키 발급
- [ ] 솔라피 발신번호 등록
- [ ] 솔라피 카카오 채널 연동
- [ ] 알림톡 템플릿 3종 등록 + 심사 통과
- [ ] Vercel 환경변수 실제 값으로 교체
- [ ] 재배포 (`vercel --prod`)
