// Database types for Supabase
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          created_at?: string;
        };
      };
      companies: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          business_content: string;
          industry: string | null;
          region: string;
          employee_count: number | null;
          revenue: string | null;
          established_date: string | null;
          profile_score: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          business_content: string;
          industry?: string | null;
          region?: string;
          employee_count?: number | null;
          revenue?: string | null;
          established_date?: string | null;
          profile_score?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          business_content?: string;
          industry?: string | null;
          region?: string;
          employee_count?: number | null;
          revenue?: string | null;
          established_date?: string | null;
          profile_score?: number;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      company_interviews: {
        Row: {
          id: string;
          company_id: string;
          question: string;
          answer: string | null;
          category: string | null;
          extracted_insights: Record<string, unknown> | null;
          question_order: number;
          round: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          question: string;
          answer?: string | null;
          category?: string | null;
          extracted_insights?: Record<string, unknown> | null;
          question_order: number;
          round?: number;
          created_at?: string;
        };
        Update: {
          answer?: string | null;
          extracted_insights?: Record<string, unknown> | null;
        };
      };
      programs: {
        Row: {
          id: string;
          source: string;
          source_id: string | null;
          title: string;
          summary: string | null;
          target: string | null;
          hashtags: string[] | null;
          apply_start: string | null;
          apply_end: string | null;
          institution: string | null;
          detail_url: string | null;
          attachment_urls: Record<string, unknown> | null;
          raw_data: Record<string, unknown> | null;
          collected_at: string;
        };
        Insert: {
          id?: string;
          source: string;
          source_id?: string | null;
          title: string;
          summary?: string | null;
          target?: string | null;
          hashtags?: string[] | null;
          apply_start?: string | null;
          apply_end?: string | null;
          institution?: string | null;
          detail_url?: string | null;
          attachment_urls?: Record<string, unknown> | null;
          raw_data?: Record<string, unknown> | null;
          collected_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["programs"]["Insert"]>;
      };
      matchings: {
        Row: {
          id: string;
          company_id: string;
          program_id: string;
          match_score: number | null;
          match_reason: string | null;
          deep_score: number | null;
          deep_report: string | null;
          region_match: boolean | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          program_id: string;
          match_score?: number | null;
          match_reason?: string | null;
          deep_score?: number | null;
          deep_report?: string | null;
          region_match?: boolean | null;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["matchings"]["Insert"]>;
      };
      business_plans: {
        Row: {
          id: string;
          matching_id: string | null;
          company_id: string;
          program_id: string | null;
          title: string;
          status: string;
          template_ocr_text: string | null;
          evaluation_criteria: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          matching_id?: string | null;
          company_id: string;
          program_id?: string | null;
          title: string;
          status?: string;
          template_ocr_text?: string | null;
          evaluation_criteria?: Record<string, unknown> | null;
        };
        Update: Partial<Database["public"]["Tables"]["business_plans"]["Insert"]>;
      };
      plan_sections: {
        Row: {
          id: string;
          plan_id: string;
          section_order: number;
          section_name: string;
          guidelines: string | null;
          evaluation_weight: number | null;
          needs_research: boolean;
          research_query_ko: string | null;
          research_query_en: string | null;
          research_result_ko: string | null;
          research_result_en: string | null;
          content: string | null;
          content_formatted: string | null;
          is_edited: boolean;
          generation_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          section_order: number;
          section_name: string;
          guidelines?: string | null;
          evaluation_weight?: number | null;
          needs_research?: boolean;
          research_query_ko?: string | null;
          research_query_en?: string | null;
          research_result_ko?: string | null;
          research_result_en?: string | null;
          content?: string | null;
          content_formatted?: string | null;
          is_edited?: boolean;
          generation_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["plan_sections"]["Insert"]>;
      };
      company_documents: {
        Row: {
          id: string;
          company_id: string;
          document_type: string;
          source: string;
          file_url: string | null;
          extracted_data: Record<string, unknown> | null;
          issued_date: string | null;
          expiry_date: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          document_type: string;
          source: string;
          file_url?: string | null;
          extracted_data?: Record<string, unknown> | null;
          issued_date?: string | null;
          expiry_date?: string | null;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_documents"]["Insert"]>;
      };
      ir_presentations: {
        Row: {
          id: string;
          plan_id: string;
          company_id: string;
          title: string;
          template: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          company_id: string;
          title: string;
          template?: string;
          status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ir_presentations"]["Insert"]>;
      };
      ir_slides: {
        Row: {
          id: string;
          presentation_id: string;
          slide_order: number;
          slide_type: string;
          title: string | null;
          content: Record<string, unknown> | null;
          notes: string | null;
          is_edited: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          presentation_id: string;
          slide_order: number;
          slide_type: string;
          title?: string | null;
          content?: Record<string, unknown> | null;
          notes?: string | null;
          is_edited?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["ir_slides"]["Insert"]>;
      };
      assistant_chats: {
        Row: {
          id: string;
          company_id: string;
          role: string;
          content: string;
          context_type: string | null;
          context_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          role: string;
          content: string;
          context_type?: string | null;
          context_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["assistant_chats"]["Insert"]>;
      };
    };
  };
}
