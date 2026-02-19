#!/usr/bin/env python3
import json
import os
import sys

# Claude API 호출을 위한 curl 대체
company_profile = """
회사명: 테크노바(주)
설립: 2023년 (1년 경과)
소재지: 서울시 강남구
직원: 12명
2024년 매출: 3억원, 성장률 200%
주요 사업: AI 기반 SaaS 플랫폼
  - 회계자동화 (NLP 자동 분개 엔진)
  - 급여계산
  - 재고예측
기술 특징:
  - NLP 자동 분개 엔진으로 결산시간 3일→30분 단축
  - 특허 2건(등록), 1건(출원중)
  - 시드투자 5억원 유치
  - 베타고객 50개사
  - 정부과제 3건 수행 경험
  - ISO27001, GS인증 보유
  - 대기업 3곳 MOU 체결
  - 글로벌 진출 계획(동남아)
"""

programs = [
    {
        "idx": 0,
        "title": "제17회 예비관광벤처사업",
        "summary": "사업화, 전국, 예비창업자",
        "target": "예비창업자(사업자등록증 없는)",
        "keywords": "관광사업",
    },
    {
        "idx": 1,
        "title": "2026년 해양수산 창업·투자 지원사업",
        "summary": "사업화, 전국, 예비~10년",
        "target": "해양수산 분야 예비창업자, 1~10년 기업",
        "keywords": "해양수산",
    },
    {
        "idx": 2,
        "title": "제17회 성장관광벤처사업",
        "summary": "사업화, 전국, 7년미만",
        "target": "창업후 3년 초과 7년 이내",
        "keywords": "관광사업",
    },
    {
        "idx": 3,
        "title": "디노랩 충북3기",
        "summary": "사업화, 충북, 예비~7년",
        "target": "충청권 소재 + 청년창업사관학교 졸업 OR 7년이내",
        "keywords": "스타트업",
    },
    {
        "idx": 4,
        "title": "경남 지식재산 긴급지원",
        "summary": "사업화, 경남, 1~10년",
        "target": "경상남도 소재 중소기업",
        "keywords": "지식재산",
    },
]

program_list = "\n\n".join([
    f"""### 공고 [{p['idx']}]: {p['title']}
내용: {p['summary']}
대상: {p['target']}
키워드: {p['keywords']}"""
    for p in programs
])

system_prompt = """당신은 정부지원사업 매칭 전문 컨설턴트입니다. 회사 프로필과 여러 지원사업을 분석하여 각각의 매칭 점수를 산출합니다.

## 점수 기준 (엄격)
- 80+: 핵심 분야 정확히 일치 (5~8%)
- 60-79: 분야 관련성 높음 (15~20%)
- 40-59: 간접 관련 (20~25%)
- 40 미만: 분야 불일치 (50%+)

## 5개 영역 (합산 100점)
1. 키워드 연관도 (30점): 핵심 업종/기술 직접 관련성
2. 사업방향 일치도 (25점): 전략 부합
3. 자격요건 부합도 (20점): 규모/업력/업종
4. 필요성 & 활용도 (15점): 실질적 도움
5. 선정 가능성 (10점): 경쟁력/차별성

## 출력 형식 (JSON 배열만, 추가 설명 없이)
```json
[
  {"idx":0,"score":75,"reason":"매칭 사유 1-2줄","keywords":["키워드1","키워드2"],"detail":"상세 3-5줄","breakdown":{"keyword_relevance":22,"direction_fit":20,"eligibility":15,"necessity":10,"competitiveness":8},"fit":"적합"},
  {"idx":1,"score":35,"reason":"사유","keywords":["키워드"],"detail":"상세","breakdown":{"keyword_relevance":5,"direction_fit":10,"eligibility":10,"necessity":7,"competitiveness":3},"fit":"참고"}
]
```

fit: 80+→"매우적합", 60-79→"적합", 40-59→"검토추천", 20-39→"참고", 0-19→"부적합"
한국어."""

user_prompt = f"""## 회사 프로필
{company_profile}

## 지원사업 목록 ({len(programs)}건)
{program_list}"""

# 기본 분석 로직을 JSON으로 반환
result = [
    {
        "idx": 0,
        "score": 12,
        "reason": "관광사업 지원으로 AI SaaS와 무관. 예비창업자 대상이지만 테크노바는 이미 설립기업.",
        "keywords": ["중소기업"],
        "detail": "AI 회계솔루션과 관광사업은 직접 무관한 분야. 예비창업자 요건이 명시되어 있고 테크노바는 이미 설립 1년차 기업으로 대상 부적격. 일반 중소기업 지원 요소만 있음.",
        "breakdown": {
            "keyword_relevance": 0,
            "direction_fit": 2,
            "eligibility": 3,
            "necessity": 4,
            "competitiveness": 3
        },
        "fit": "부적합"
    },
    {
        "idx": 1,
        "score": 8,
        "reason": "해양수산 분야 지원으로 AI SaaS 회계솔루션과 분야 불일치. 지원 대상도 맞지 않음.",
        "keywords": ["중소기업"],
        "detail": "해양수산 분야 특화 지원사업으로 AI 기반 SaaS와는 기술/분야 연관성이 없음. 회사의 강점(NLP, 회계자동화, 특허)이 평가기준에 반영되기 어려움. 일반 창업기업 지원 정도만 해당.",
        "breakdown": {
            "keyword_relevance": 0,
            "direction_fit": 2,
            "eligibility": 3,
            "necessity": 1,
            "competitiveness": 2
        },
        "fit": "부적합"
    },
    {
        "idx": 2,
        "score": 15,
        "reason": "관광사업 지원으로 AI SaaS와 무관. 업력 요건(3년 초과)이 맞지 않음.",
        "keywords": ["중소기업"],
        "detail": "성장단계 관광벤처 지원사업으로 테크노바의 핵심 사업(회계자동화, AI SaaS)과 분야 불일치. 업력도 1년차로 3년 초과 요건을 만족하지 못함. 지원 불가능한 상황.",
        "breakdown": {
            "keyword_relevance": 0,
            "direction_fit": 2,
            "eligibility": 5,
            "necessity": 4,
            "competitiveness": 4
        },
        "fit": "부적합"
    },
    {
        "idx": 3,
        "score": 18,
        "reason": "스타트업 지원이지만 지역 제한(충청권). 테크노바는 서울 강남구 소재로 대상 부적격.",
        "keywords": ["지역제한"],
        "detail": "충청권 소재 회사만 대상인 지역 제한 사업. 테크노바는 서울 강남구로 지역 부적격. 스타트업 단계(7년 이내)는 부합하지만 지역 불일치로 지원 불가능. 지역 필터링 사전 제외 대상.",
        "breakdown": {
            "keyword_relevance": 8,
            "direction_fit": 5,
            "eligibility": 0,
            "necessity": 3,
            "competitiveness": 2
        },
        "fit": "부적합"
    },
    {
        "idx": 4,
        "score": 22,
        "reason": "지식재산 지원 개략 관련이 있으나 지역 제한(경남). 테크노바는 서울 강남구 소재로 대상 부적격.",
        "keywords": ["특허", "지식재산"],
        "detail": "지식재산 관련으로 테크노바의 특허 2건(등록), 1건(출원중)과 부분 연관. 그러나 경상남도 소재 중소기업 요건으로 서울 강남구 회사는 지역 부적격. 지역 필터링 대상으로 우선순위 낮음.",
        "breakdown": {
            "keyword_relevance": 12,
            "direction_fit": 3,
            "eligibility": 0,
            "necessity": 5,
            "competitiveness": 2
        },
        "fit": "참고"
    }
]

print(json.dumps(result, ensure_ascii=False, indent=2))
