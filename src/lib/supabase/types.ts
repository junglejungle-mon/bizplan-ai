// Database types for Supabase
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          phone: string | null;
          phone_verified: boolean;
          kakao_id: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          phone?: string | null;
          phone_verified?: boolean;
          kakao_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          phone?: string | null;
          phone_verified?: boolean;
          kakao_id?: string | null;
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
          form_template_id: string | null;
          fill_strategy: string | null;
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
          form_template_id?: string | null;
          fill_strategy?: string | null;
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
      notification_settings: {
        Row: {
          id: string;
          user_id: string;
          channel: "kakao" | "email" | "discord";
          enabled: boolean;
          notify_matching: boolean;
          notify_deadline: boolean;
          notify_plan_complete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          channel: "kakao" | "email" | "discord";
          enabled?: boolean;
          notify_matching?: boolean;
          notify_deadline?: boolean;
          notify_plan_complete?: boolean;
        };
        Update: {
          enabled?: boolean;
          notify_matching?: boolean;
          notify_deadline?: boolean;
          notify_plan_complete?: boolean;
          updated_at?: string;
        };
      };
      reference_documents: {
        Row: {
          id: string;
          title: string;
          file_name: string;
          file_url: string | null;
          reference_type: string;
          template_type: string;
          status: "pending" | "processing" | "completed" | "failed";
          ocr_text: string | null;
          metadata: Record<string, unknown> | null;
          chunk_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          file_name: string;
          file_url?: string | null;
          reference_type?: string;
          template_type?: string;
          status?: string;
          ocr_text?: string | null;
          metadata?: Record<string, unknown> | null;
          chunk_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["reference_documents"]["Insert"]>;
      };
      reference_chunks: {
        Row: {
          id: string;
          document_id: string;
          content: string;
          section_name: string | null;
          chunk_index: number;
          embedding: number[] | null;
          token_count: number;
          template_type: string | null;
          reference_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          content: string;
          section_name?: string | null;
          chunk_index?: number;
          embedding?: number[] | null;
          token_count?: number;
          template_type?: string | null;
          reference_type?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reference_chunks"]["Insert"]>;
      };
      notification_logs: {
        Row: {
          id: string;
          user_id: string;
          channel: "kakao" | "email" | "discord";
          notification_type: "matching" | "deadline" | "plan_complete";
          template_id: string | null;
          recipient: string | null;
          variables: Record<string, unknown> | null;
          status: "pending" | "sent" | "failed";
          error_message: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          channel: "kakao" | "email" | "discord";
          notification_type: "matching" | "deadline" | "plan_complete";
          template_id?: string | null;
          recipient?: string | null;
          variables?: Record<string, unknown> | null;
          status?: "pending" | "sent" | "failed";
          error_message?: string | null;
          sent_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notification_logs"]["Insert"]>;
      };
      form_templates: {
        Row: {
          id: string;
          program_id: string;
          source_url: string;
          file_type: "hwpx" | "hwp";
          file_size: number | null;
          storage_path: string | null;
          parsed_structure: Record<string, unknown> | null;
          field_mappings: Record<string, unknown>[] | null;
          form_title: string | null;
          status: "pending" | "downloaded" | "parsed" | "mapped" | "failed";
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          source_url: string;
          file_type?: "hwpx" | "hwp";
          file_size?: number | null;
          storage_path?: string | null;
          parsed_structure?: Record<string, unknown> | null;
          field_mappings?: Record<string, unknown>[] | null;
          form_title?: string | null;
          status?: string;
          error_message?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["form_templates"]["Insert"]>;
      };
      // ── 결제 시스템 테이블 ──
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
          price: number;
          currency: string;
          interval: string;
          features: unknown[];
          limits: Record<string, number>;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
          price?: number;
          currency?: string;
          interval?: string;
          features?: unknown[];
          limits?: Record<string, number>;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["subscription_plans"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: "active" | "canceled" | "past_due" | "trialing" | "expired";
          current_period_start: string;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          portone_billing_key: string | null;
          portone_customer_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status?: string;
          current_period_start?: string;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          portone_billing_key?: string | null;
          portone_customer_id?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string | null;
          amount: number;
          currency: string;
          status: "pending" | "paid" | "failed" | "canceled" | "refunded";
          portone_payment_id: string | null;
          payment_method: string | null;
          payment_method_detail: Record<string, unknown> | null;
          paid_at: string | null;
          failed_reason: string | null;
          receipt_url: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id?: string | null;
          amount: number;
          currency?: string;
          status?: string;
          portone_payment_id?: string | null;
          payment_method?: string | null;
          payment_method_detail?: Record<string, unknown> | null;
          paid_at?: string | null;
          failed_reason?: string | null;
          receipt_url?: string | null;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      usage_records: {
        Row: {
          id: string;
          user_id: string;
          period: string;
          plan_generations: number;
          section_regenerations: number;
          ir_generations: number;
          exports: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          period: string;
          plan_generations?: number;
          section_regenerations?: number;
          ir_generations?: number;
          exports?: number;
        };
        Update: Partial<Database["public"]["Tables"]["usage_records"]["Insert"]>;
      };
      agent_meetings: {
        Row: {
          id: string;
          meeting_type: 'weekly' | 'monthly';
          meeting_date: string;
          week_number: number | null;
          status: 'pending' | 'collecting_metrics' | 'strategy_meeting' | 'team_analysis' | 'uploading_notion' | 'completed' | 'failed';
          current_phase: string | null;
          service_metrics: Record<string, unknown> | null;
          strategy_summary: string | null;
          strategy_result: Record<string, unknown> | null;
          team_reports: Record<string, unknown>[];
          notion_page_id: string | null;
          notion_page_url: string | null;
          total_tokens: number;
          total_cost_usd: number;
          duration_ms: number | null;
          triggered_by: string;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          meeting_type: 'weekly' | 'monthly';
          meeting_date: string;
          week_number?: number | null;
          status?: string;
          current_phase?: string | null;
          service_metrics?: Record<string, unknown> | null;
          strategy_summary?: string | null;
          strategy_result?: Record<string, unknown> | null;
          team_reports?: Record<string, unknown>[];
          notion_page_id?: string | null;
          notion_page_url?: string | null;
          total_tokens?: number;
          total_cost_usd?: number;
          duration_ms?: number | null;
          triggered_by?: string;
          error_message?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["agent_meetings"]["Insert"]>;
      };
      agent_missions: {
        Row: {
          id: string;
          meeting_id: string;
          team_id: string;
          team_name: string;
          chief: string;
          title: string;
          description: string | null;
          category: 'strategy' | 'marketing' | 'product' | 'tech' | 'data' | 'growth' | 'ops';
          priority: 'critical' | 'high' | 'medium' | 'low';
          expected_outcome: string | null;
          kpi_target: Record<string, unknown> | null;
          approval_status: 'pending' | 'approved' | 'rejected' | 'deferred';
          approved_at: string | null;
          rejection_reason: string | null;
          execution_status: 'waiting' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
          started_at: string | null;
          completed_at: string | null;
          completion_notes: string | null;
          due_date: string | null;
          notion_block_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          team_id: string;
          team_name: string;
          chief: string;
          title: string;
          description?: string | null;
          category: string;
          priority?: string;
          expected_outcome?: string | null;
          kpi_target?: Record<string, unknown> | null;
          approval_status?: string;
          rejection_reason?: string | null;
          execution_status?: string;
          due_date?: string | null;
          notion_block_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["agent_missions"]["Insert"]>;
      };
    };
  };
}
