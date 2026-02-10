/**
 * HWPX 양식폼 자동채우기 - 공통 타입 정의
 * 모든 HWPX 모듈이 공유하는 인터페이스
 */

// ===== 양식폼 파서 출력 =====

/** 양식폼에서 추출한 개별 필드 */
export interface FormField {
  /** 고유 ID (예: "field_0_3") */
  id: string;
  /** 필드 라벨 (예: "사업명", "추진 배경 및 필요성") */
  label: string;
  /** 필드 유형 */
  type: "text" | "textarea" | "table_cell";
  /** XML 내 위치 (paragraph index 기반) */
  xpath: string;
  /** 소속 section 파일 (예: "Contents/section0.xml") */
  sectionFile: string;
  /** 주변 컨텍스트 */
  context: {
    sectionTitle: string;
    subsectionTitle: string;
    precedingText: string;
  };
  /** 테이블 안에 있는 필드인지 */
  isInTable: boolean;
  /** 내용이 비어있는 칸인지 (작성 대상) */
  isEmpty: boolean;
}

/** 양식 섹션 구조 */
export interface FormSection {
  title: string;
  level: number;
  subsections: Array<{
    title: string;
    fields: string[]; // FormField.id 참조
  }>;
}

/** 파싱된 양식 전체 구조 */
export interface ParsedForm {
  fields: FormField[];
  structure: FormSection[];
  /** sectionFile → xml 원본 */
  rawXmlMap: Record<string, string>;
  metadata: {
    title: string;
    totalFields: number;
    complexity: "simple" | "medium" | "complex";
  };
}

// ===== AI 필드 매핑 =====

/** AI가 매핑한 양식필드 ↔ 사업계획서 섹션 매칭 결과 */
export interface FieldMapping {
  formFieldId: string;
  formFieldLabel: string;
  planSectionOrder: number;
  planSectionName: string;
  /** 채우기 전략 */
  strategy: "direct" | "extract" | "summarize" | "skip";
  /** 매핑 신뢰도 (0-100) */
  confidence: number;
  /** strategy=extract/summarize일 때 AI에게 전달할 추출 프롬프트 */
  extractPrompt?: string;
}

// ===== 채우기 결과 =====

/** 양식 채우기 최종 결과 */
export interface FillResult {
  success: boolean;
  /** 어떤 전략으로 생성했는지 */
  strategy: "smart_fill" | "placeholder_fill" | "from_scratch";
  filledFields: number;
  skippedFields: number;
  buffer: Buffer;
  warnings: string[];
}

// ===== DB 모델 =====

/** form_templates 테이블 레코드 */
export interface FormTemplate {
  id: string;
  program_id: string;
  source_url: string;
  file_type: "hwpx" | "hwp";
  file_size?: number;
  storage_path?: string;
  parsed_structure?: ParsedForm;
  field_mappings?: FieldMapping[];
  form_title?: string;
  status: "pending" | "downloaded" | "parsed" | "mapped" | "failed";
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// ===== 공통 유틸리티 타입 =====

/** 사업계획서 데이터 (export 시 사용) */
export interface BusinessPlanData {
  planId: string;
  title: string;
  companyName: string;
  programId?: string;
  sections: Array<{
    section_name: string;
    content: string | null;
    section_order: number;
  }>;
  chartData?: Record<string, unknown[]>;
  kpiData?: Record<string, unknown>;
  templateType?: string;
}
