-- 008: PPT/IR 품질 채점 + PPT 전용 패턴 시드
-- winning_patterns 테이블 재활용 (category = 'ppt_*')

-- ============================================================
-- 1. PPT 품질 채점 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS ppt_quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES ir_presentations(id) ON DELETE CASCADE,

  total_score INT NOT NULL DEFAULT 0,  -- 0~100

  -- 8개 채점 항목
  score_text_density INT DEFAULT 0,       -- 텍스트 밀도 적정성 (15)
  score_numeric_data INT DEFAULT 0,       -- 정량 데이터 활용 (15)
  score_visual_elements INT DEFAULT 0,    -- 시각화 요소 (15)
  score_story_flow INT DEFAULT 0,         -- 스토리 흐름 (15)
  score_slide_count INT DEFAULT 0,        -- 슬라이드 분량 (10)
  score_consistency INT DEFAULT 0,        -- 디자인 일관성 (10)
  score_data_source INT DEFAULT 0,        -- 출처/근거 (10)
  score_investor_appeal INT DEFAULT 0,    -- 투자자 어필 (10)

  details JSONB,
  improvement_suggestions JSONB,
  scored_by TEXT DEFAULT 'auto',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ppt_quality_presentation ON ppt_quality_scores(presentation_id);

-- RLS
ALTER TABLE ppt_quality_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role access ppt_quality_scores" ON ppt_quality_scores
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users read own ppt_quality_scores" ON ppt_quality_scores FOR SELECT TO authenticated
    USING (presentation_id IN (
      SELECT ip.id FROM ir_presentations ip
      JOIN business_plans bp ON ip.plan_id = bp.id
      JOIN companies c ON bp.company_id = c.id
      WHERE c.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. PPT winning_patterns 시드 데이터
-- (기존 winning_patterns 테이블에 category='ppt_*'로 삽입)
-- ============================================================

-- === PPT 구조 패턴 ===
INSERT INTO winning_patterns (category, subcategory, title, description, good_examples, bad_examples, applicable_templates, weight, is_active)
VALUES
-- 슬라이드 구성
('ppt_structure', 'slide_composition', '10~15장 최적 분량',
 '투자자는 10~15장 내에서 핵심을 파악하길 원합니다. 20장 초과 시 집중도가 급락합니다.',
 '["12장 구성: 표지→문제→솔루션→시장→BM→트랙션→경쟁→기술→팀→재무→투자요청→로드맵"]',
 '["35장 PPT에 모든 내용을 담으려는 시도", "5장으로 압축하여 핵심 누락"]',
 '{"ir_pitch", "startup_package"}', 15, true),

('ppt_structure', 'story_arc', '문제→해결→증명→미래 스토리 아크',
 '투자자를 설득하는 황금 구조: 왜 필요한지(문제) → 어떻게 해결하는지(솔루션) → 이미 증명했는지(트랙션) → 얼마나 커질 수 있는지(시장+재무)',
 '["Problem(2p)→Solution(1p)→Market(1p)→BM(1p)→Traction(1p)→Team(1p)→Ask(1p) 흐름"]',
 '["팀소개로 시작하여 문제를 나중에 설명", "시장 크기를 먼저 제시하고 문제를 뒤에 배치"]',
 '{"ir_pitch"}', 15, true),

('ppt_structure', 'one_message_per_slide', '슬라이드당 핵심 메시지 1개',
 '한 슬라이드에 하나의 핵심 메시지만 전달합니다. 여러 메시지를 담으면 투자자의 집중도가 분산됩니다.',
 '["시장규모 슬라이드: TAM/SAM/SOM 동심원 + 핵심 수치 3개만 배치"]',
 '["시장규모 슬라이드에 경쟁사 분석, BM, 기술 특장점까지 모두 포함"]',
 '{"ir_pitch", "startup_package", "growth_package"}', 12, true),

-- === PPT 콘텐츠 패턴 ===
('ppt_content', 'text_density', '슬라이드당 100~150자 (한글 기준)',
 'NAS 분석 결과 선정 PPT의 평균 텍스트 밀도는 슬라이드당 107~155자입니다. 200자 초과 시 가독성이 급락합니다.',
 '["반려동물 헬스케어 시장 4조원 돌파 (2024, 농림축산부) — 연평균 15% 성장"]',
 '["반려동물 헬스케어 시장은 최근 몇 년간 지속적으로 성장하고 있으며 2024년 기준 약 4조원 규모에 달하는 것으로 추정됩니다. 농림축산식품부 자료에 의하면..."]',
 '{"ir_pitch", "startup_package", "growth_package"}', 15, true),

('ppt_content', 'bold_numbers', '매 슬라이드 정량 데이터 1개 이상',
 '투자자는 숫자로 판단합니다. 모든 슬라이드에 최소 1개의 볼드 숫자/통계를 포함하세요.',
 '["매출 30억 | 고객사 15곳 | 성장률 275% | 수출 10만불", "TAM $50B → SAM $2.5B → SOM $125M"]',
 '["많은 고객을 확보하고 있습니다", "시장이 매우 크고 빠르게 성장 중입니다"]',
 '{"ir_pitch", "startup_package"}', 15, true),

('ppt_content', 'bullet_limit', '불릿 3개 이하',
 '한 슬라이드에 불릿은 3개 이하로 제한합니다. 5개 이상이면 읽히지 않습니다.',
 '["✅ 특허 2건 보유 (등록 완료)\n✅ GS인증 1등급 획득\n✅ 조달등록 완료"]',
 '["7개 불릿으로 기술 특장점을 나열한 슬라이드"]',
 '{"ir_pitch"}', 10, true),

('ppt_content', 'source_citation', '통계/수치에 출처 표기',
 '시장규모, 성장률, 산업통계에는 반드시 출처를 표기합니다. 신뢰도를 높이는 핵심 요소입니다.',
 '["반려동물 시장 4조원 (2024, 농림축산식품부)", "CAGR 23.5% (Grand View Research, 2025)"]',
 '["시장 규모 10조원", "연간 성장률 30%"]',
 '{"ir_pitch", "startup_package", "growth_package"}', 10, true),

-- === PPT 디자인 패턴 ===
('ppt_design', 'color_palette', '주색상 1개 + 강조색 1개 + 중립색',
 'NAS 분석 결과: 선정 PPT는 주로 네이비/파랑(#023793, #003366) + 빨강 강조(#FF0000) + 검정 텍스트 조합입니다.',
 '["주색: #023793(네이비) + 강조: #FF0000(레드) + 본문: #333333", "주색: #1a1a2e(다크) + 강조: #4361ee(블루) + 배경: #FFFFFF"]',
 '["슬라이드마다 다른 색상 테마 사용", "5가지 이상 색상을 혼합 사용"]',
 '{"ir_pitch", "startup_package", "growth_package"}', 10, true),

('ppt_design', 'font_system', '폰트 2종 이내 (제목 + 본문)',
 'NAS 분석: 선정 PPT는 KoPub돋움(제목+본문), 에스코어드림(4종 웨이트), 맑은고딕 등 패밀리 1~2개만 사용합니다.',
 '["제목: KoPub돋움 Bold 22pt / 본문: KoPub돋움 Medium 12pt", "제목: 에스코어드림 9 Black 24pt / 본문: 에스코어드림 4 Regular 12pt"]',
 '["슬라이드마다 다른 폰트 사용", "4종 이상 서로 다른 폰트 패밀리 혼합"]',
 '{"ir_pitch", "startup_package", "growth_package"}', 8, true),

('ppt_design', 'font_size_hierarchy', '폰트 크기 3단계 위계',
 '제목(20-24pt), 소제목(14-16pt), 본문(10-12pt) 3단계로 명확한 위계를 잡습니다.',
 '["제목 22pt → 소제목 16pt → 본문 12pt → 출처 8pt"]',
 '["모든 텍스트가 동일한 크기", "제목이 본문보다 작은 경우"]',
 '{"ir_pitch", "startup_package", "growth_package"}', 8, true),

('ppt_design', 'visual_ratio', '시각 요소 비율 60% 이상',
 'NAS 분석: 선정 PPT(비티큐티)는 13장에 이미지 25개 + 테이블 3개로 시각 요소가 풍부합니다. 텍스트만으로 채운 슬라이드는 피하세요.',
 '["이미지/차트/아이콘이 슬라이드 면적의 60% 이상", "TAM/SAM/SOM 도넛차트 + KPI 카드 3개"]',
 '["텍스트로만 가득 찬 슬라이드", "이미지 없이 불릿 리스트만 나열"]',
 '{"ir_pitch"}', 12, true),

('ppt_design', 'slide_ratio', '16:9 와이드스크린 비율',
 'NAS 분석: 최근 PPT는 13.3x7.5(16:9) 또는 11.0x7.1 비율입니다. 4:3 비율은 구시대적 느낌을 줍니다.',
 '["16:9 와이드스크린 (13.3 x 7.5 인치)"]',
 '["4:3 비율 (10.0 x 7.5 인치) 사용"]',
 '{"ir_pitch"}', 5, true),

-- === PPT 슬라이드별 패턴 ===
('ppt_slide_type', 'problem_slide', 'Problem 슬라이드: 통계 + 페인포인트',
 '문제 정의 슬라이드는 핵심 통계 3개 + 임팩트 있는 헤드라인으로 구성합니다.',
 '["헤드라인: \"반려동물 구강질환 80% — 방치되는 반려동물 건강\"\n통계: 🐕 1,500만 반려동물 | 🦷 80% 구강질환 | 💊 치료비 평균 50만원"]',
 '["\"반려동물 시장에 여러 문제가 있습니다\"라는 추상적 서술"]',
 '{"ir_pitch"}', 10, true),

('ppt_slide_type', 'market_slide', 'Market 슬라이드: TAM/SAM/SOM 필수',
 '시장규모는 반드시 TAM(전체)→SAM(목표)→SOM(초기진입) 3단계로 제시합니다.',
 '["TAM: 글로벌 펫케어 $320B\nSAM: 국내 반려동물 헬스케어 4조원\nSOM: 구강케어 제품 시장 400억원\n(출처: Euromonitor 2025, 농림부)"]',
 '["시장이 크다는 설명만 있고 구체적 수치 없음"]',
 '{"ir_pitch"}', 10, true),

('ppt_slide_type', 'traction_slide', 'Traction 슬라이드: 우상향 그래프 필수',
 '트랙션은 반드시 시각적 그래프(막대/꺾은선)로 우상향 추세를 보여줍니다.',
 '["매출 추이 막대차트: 22년 8억 → 23년 30억 → 24년 80억 (275% 성장)\nKPI: 고객사 15곳 | 재구매율 85% | NPS 72"]',
 '["매출이 증가하고 있다는 텍스트만 기재"]',
 '{"ir_pitch"}', 10, true),

('ppt_slide_type', 'ask_slide', 'Ask 슬라이드: 금액 + 사용처 명확',
 '투자 요청은 금액, 밸류에이션, 자금사용계획(파이차트)을 명확히 제시합니다.',
 '["투자 요청: 30억원 (Pre-A)\n밸류에이션: 150억원\n자금사용: R&D 40% | 마케팅 30% | 인력 20% | 운영 10%"]',
 '["투자를 받고 싶습니다"]',
 '{"ir_pitch"}', 10, true)

ON CONFLICT DO NOTHING;

-- === PPT 전용 평가기준 ===
INSERT INTO evaluation_criteria (template_type, section_name, score_weight, criteria, high_score_strategy, section_order, is_active)
VALUES
('ir_pitch', '텍스트 밀도', 15,
 ARRAY['슬라이드당 평균 100~150자 이내', '불릿 3개 이하', '키워드 중심 표현', '장문 서술 없음'],
 '50단어 이하로 핵심만 전달. 숫자와 키워드로 압축.', 1, true),

('ir_pitch', '정량 데이터', 15,
 ARRAY['모든 슬라이드에 숫자 1개 이상', '매출/성장률/시장규모 등 핵심 지표', '출처 명시', 'KPI 하이라이트'],
 '볼드 처리된 핵심 숫자로 투자자 시선을 사로잡기.', 2, true),

('ir_pitch', '시각화 요소', 15,
 ARRAY['차트/그래프 3개 이상', 'TAM/SAM/SOM 도넛차트', '트랙션 막대/꺾은선', '자금사용 파이차트'],
 '텍스트 대신 차트로 데이터 스토리텔링.', 3, true),

('ir_pitch', '스토리 흐름', 15,
 ARRAY['문제→해결→시장→모델→증명→팀→요청 순서', '논리적 연결', '각 슬라이드 간 전환 자연스러움'],
 'Problem-Solution-Proof-Scale 4단계 구조.', 4, true),

('ir_pitch', '슬라이드 분량', 10,
 ARRAY['10~15장 최적', '20장 이하 필수', '표지와 감사 페이지 포함'],
 '12장이 황금 비율. 핵심만 담기.', 5, true),

('ir_pitch', '디자인 일관성', 10,
 ARRAY['색상 2~3종 이내', '폰트 패밀리 2종 이내', '크기 위계 3단계', '레이아웃 통일'],
 '주색+강조색+중립색 3색 체계 유지.', 6, true),

('ir_pitch', '출처/근거', 10,
 ARRAY['시장통계 출처 표기', '정부/연구기관 데이터 우선', '자체 데이터 명시', '연도 표기'],
 'A+등급 출처(정부통계) 2개 이상 포함.', 7, true),

('ir_pitch', '투자자 어필', 10,
 ARRAY['명확한 투자 금액과 밸류에이션', '자금 사용 계획 시각화', 'Exit 전략 언급', 'Why Now 제시'],
 '투자자가 다음 미팅을 잡고 싶게 만드는 마지막 슬라이드.', 8, true)

ON CONFLICT (template_type, section_name) DO NOTHING;

-- ============================================================
-- 3. 슬라이드 레퍼런스 테이블 (Few-shot 학습용)
-- 실제 선정된 PPT에서 슬라이드 단위로 추출한 텍스트
-- ============================================================
CREATE TABLE IF NOT EXISTS slide_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file TEXT NOT NULL,
  slide_number INT NOT NULL,
  slide_type TEXT NOT NULL,
  title TEXT,
  full_text TEXT NOT NULL,
  char_count INT,
  line_count INT,
  quality_rating INT DEFAULT 0,  -- 0~5, 수동/자동 평점
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_file, slide_number)
);

CREATE INDEX IF NOT EXISTS idx_slide_refs_type ON slide_references(slide_type);

ALTER TABLE slide_references ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role access slide_references" ON slide_references
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
