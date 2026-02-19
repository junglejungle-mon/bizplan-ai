/**
 * 회사 프로필 완성도 점수 계산 유틸리티
 *
 * 점수 구성 (100점 만점):
 * - 기본 정보 (30점): 회사명, 업종, 지역, 직원수, 매출, 설립일
 * - 사업 내용 (30점): business_content 길이/품질
 * - 인터뷰 데이터 (40점): 답변 개수 기반
 */

interface CompanyData {
  name?: string | null;
  industry?: string | null;
  region?: string | null;
  employee_count?: number | null;
  revenue?: string | null;
  established_date?: string | null;
  business_content?: string | null;
}

/**
 * 기본 정보 필드 기반 점수 계산 (최대 30점)
 */
function calculateBasicInfoScore(company: CompanyData): number {
  let score = 0;

  // 회사명 (5점)
  if (company.name && company.name.trim().length > 0) score += 5;

  // 업종 (5점)
  if (company.industry && company.industry.trim().length > 0) score += 5;

  // 지역 (4점)
  if (company.region && company.region.trim().length > 0) score += 4;

  // 직원수 (4점)
  if (company.employee_count && company.employee_count > 0) score += 4;

  // 매출 (6점)
  if (company.revenue && company.revenue.trim().length > 0) score += 6;

  // 설립일 (6점)
  if (company.established_date && company.established_date.trim().length > 0) score += 6;

  return score;
}

/**
 * 사업 내용(business_content) 기반 점수 계산 (최대 30점)
 */
function calculateContentScore(businessContent: string | null | undefined): number {
  if (!businessContent || businessContent.trim().length === 0) return 0;

  const length = businessContent.trim().length;

  // 길이 기반 점수
  if (length >= 500) return 30;
  if (length >= 300) return 25;
  if (length >= 150) return 20;
  if (length >= 80) return 15;
  if (length >= 30) return 10;
  return 5;
}

/**
 * 인터뷰 답변 기반 점수 계산 (최대 40점)
 */
function calculateInterviewScore(answeredCount: number): number {
  // 15개 질문 기준 (라운드당 3개 x 5라운드)
  // 답변 1개당 약 2.67점
  const maxQuestions = 15;
  const score = Math.round((answeredCount / maxQuestions) * 40);
  return Math.min(score, 40);
}

/**
 * 회사 프로필 점수를 계산합니다.
 *
 * @param company - 회사 데이터
 * @param answeredCount - 인터뷰 답변 개수
 * @returns 0~100 사이의 프로필 점수
 */
export function calculateProfileScore(
  company: CompanyData,
  answeredCount: number = 0
): number {
  const basicScore = calculateBasicInfoScore(company);
  const contentScore = calculateContentScore(company.business_content);
  const interviewScore = calculateInterviewScore(answeredCount);

  const total = basicScore + contentScore + interviewScore;

  return Math.min(Math.max(total, 0), 100);
}

/**
 * 점수 상세 내역을 반환합니다 (디버깅/UI용).
 */
export function getProfileScoreBreakdown(
  company: CompanyData,
  answeredCount: number = 0
): {
  basic: number;
  content: number;
  interview: number;
  total: number;
} {
  const basic = calculateBasicInfoScore(company);
  const content = calculateContentScore(company.business_content);
  const interview = calculateInterviewScore(answeredCount);

  return {
    basic,
    content,
    interview,
    total: Math.min(basic + content + interview, 100),
  };
}
