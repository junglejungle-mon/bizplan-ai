/**
 * 정부지원사업 템플릿별 차트 색상 테마
 */

export interface ChartTheme {
  name: string;
  primary: string;       // 메인 컬러 (헤더, 제목)
  accent: string;        // 강조 컬러
  background: string;    // 배경
  textDark: string;      // 본문 텍스트
  textLight: string;     // 보조 텍스트
  positive: string;      // 긍정 (성장, 이익)
  negative: string;      // 부정 (감소, 비용)
  chartColors: string[]; // 차트용 5색 팔레트
  headerBg: string;      // 테이블 헤더 배경
  headerText: string;    // 테이블 헤더 텍스트
  gridColor: string;     // 그리드/구분선
}

const themes: Record<string, ChartTheme> = {
  startup_package: {
    name: "Blue Innovation",
    primary: "#2563EB",
    accent: "#F59E0B",
    background: "#EFF6FF",
    textDark: "#1E293B",
    textLight: "#64748B",
    positive: "#22C55E",
    negative: "#EF4444",
    chartColors: ["#2563EB", "#F59E0B", "#10B981", "#8B5CF6", "#EC4899"],
    headerBg: "#2563EB",
    headerText: "#FFFFFF",
    gridColor: "#E2E8F0",
  },
  growth_package: {
    name: "Growth Green",
    primary: "#059669",
    accent: "#0EA5E9",
    background: "#ECFDF5",
    textDark: "#1E293B",
    textLight: "#64748B",
    positive: "#22C55E",
    negative: "#EF4444",
    chartColors: ["#059669", "#0EA5E9", "#F59E0B", "#8B5CF6", "#EC4899"],
    headerBg: "#059669",
    headerText: "#FFFFFF",
    gridColor: "#D1FAE5",
  },
  dips: {
    name: "Deep Tech Purple",
    primary: "#7C3AED",
    accent: "#EC4899",
    background: "#F5F3FF",
    textDark: "#1E293B",
    textLight: "#64748B",
    positive: "#22C55E",
    negative: "#EF4444",
    chartColors: ["#7C3AED", "#EC4899", "#0EA5E9", "#F59E0B", "#10B981"],
    headerBg: "#7C3AED",
    headerText: "#FFFFFF",
    gridColor: "#E9D5FF",
  },
  export_voucher: {
    name: "Global Teal",
    primary: "#0D9488",
    accent: "#F97316",
    background: "#F0FDFA",
    textDark: "#1E293B",
    textLight: "#64748B",
    positive: "#22C55E",
    negative: "#EF4444",
    chartColors: ["#0D9488", "#F97316", "#3B82F6", "#8B5CF6", "#EC4899"],
    headerBg: "#0D9488",
    headerText: "#FFFFFF",
    gridColor: "#CCFBF1",
  },
  sme_fund: {
    name: "SME Navy",
    primary: "#1E40AF",
    accent: "#10B981",
    background: "#EFF6FF",
    textDark: "#1E293B",
    textLight: "#64748B",
    positive: "#22C55E",
    negative: "#EF4444",
    chartColors: ["#1E40AF", "#10B981", "#F59E0B", "#EC4899", "#0EA5E9"],
    headerBg: "#1E40AF",
    headerText: "#FFFFFF",
    gridColor: "#DBEAFE",
  },
  innovation_growth: {
    name: "Innovation Red",
    primary: "#DC2626",
    accent: "#3B82F6",
    background: "#FEF2F2",
    textDark: "#1E293B",
    textLight: "#64748B",
    positive: "#22C55E",
    negative: "#EF4444",
    chartColors: ["#DC2626", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6"],
    headerBg: "#DC2626",
    headerText: "#FFFFFF",
    gridColor: "#FECACA",
  },
  custom: {
    name: "Classic Blue",
    primary: "#1E40AF",
    accent: "#F59E0B",
    background: "#F8FAFC",
    textDark: "#1E293B",
    textLight: "#64748B",
    positive: "#22C55E",
    negative: "#EF4444",
    chartColors: ["#1E40AF", "#F59E0B", "#10B981", "#EC4899", "#0EA5E9"],
    headerBg: "#1E40AF",
    headerText: "#FFFFFF",
    gridColor: "#E2E8F0",
  },
};

export function getThemeForTemplate(templateType?: string): ChartTheme {
  return themes[templateType || "custom"] || themes.custom;
}
