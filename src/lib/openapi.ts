/**
 * OpenAPI 3.0 스펙 (BizPlan AI API)
 *
 * 관리자 페이지 /admin/api-docs에서 Swagger UI로 렌더링
 */

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "BizPlan AI API",
    description: "정글몬스터 사업계획서 AI 생성 플랫폼 API 문서",
    version: "1.0.0",
    contact: { name: "정글몬스터", url: "https://bizplan.kkuddu.org" },
  },
  servers: [
    { url: "/api", description: "현재 서버" },
  ],
  tags: [
    { name: "Auth", description: "인증" },
    { name: "Company", description: "기업 정보" },
    { name: "Plans", description: "사업계획서" },
    { name: "IR", description: "IR 프레젠테이션" },
    { name: "Programs", description: "지원사업 프로그램" },
    { name: "Matching", description: "기업-프로그램 매칭" },
    { name: "Documents", description: "문서 관리" },
    { name: "Payments", description: "결제/구독" },
    { name: "Admin", description: "관리자 API" },
    { name: "Admin-Plans", description: "관리자 - 사업계획서" },
    { name: "Admin-IR", description: "관리자 - IR" },
    { name: "Admin-Programs", description: "관리자 - 프로그램" },
    { name: "Admin-Users", description: "관리자 - 사용자" },
    { name: "Admin-Dashboard", description: "관리자 - 대시보드" },
    { name: "Admin-Quality", description: "관리자 - 품질 관리" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "Supabase JWT 토큰",
      },
      adminCookie: {
        type: "apiKey",
        in: "cookie",
        name: "admin-session",
        description: "관리자 HMAC 쿠키 (admin 미들웨어)",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "에러 메시지" },
        },
      },
      Plan: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string", example: "2025 AI 스타트업 사업계획서" },
          status: { type: "string", enum: ["draft", "generating", "completed", "error"] },
          company_id: { type: "string", format: "uuid" },
          program_id: { type: "string", format: "uuid", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      PlanSection: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          plan_id: { type: "string", format: "uuid" },
          section_name: { type: "string", example: "사업 개요" },
          section_order: { type: "integer" },
          content: { type: "string" },
          generation_count: { type: "integer" },
        },
      },
      Program: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string", example: "2025 AI 바우처 지원사업" },
          source: { type: "string", example: "k-startup" },
          institution: { type: "string", example: "중소벤처기업부" },
          target: { type: "string" },
          apply_start: { type: "string", format: "date" },
          apply_end: { type: "string", format: "date" },
          detail_url: { type: "string", format: "uri" },
          collected_at: { type: "string", format: "date-time" },
        },
      },
      Company: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "정글몬스터" },
          industry: { type: "string", example: "반려동물 헬스케어" },
          region: { type: "string", example: "서울" },
          business_number: { type: "string" },
        },
      },
      QualityScore: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          plan_id: { type: "string", format: "uuid" },
          total_score: { type: "number", example: 82.5 },
          criteria_scores: { type: "object" },
          feedback: { type: "string" },
        },
      },
      IRPresentation: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          plan_id: { type: "string", format: "uuid" },
          title: { type: "string" },
          template: { type: "string", enum: ["minimal", "tech", "classic"] },
          status: { type: "string", enum: ["draft", "generating", "completed", "error"] },
        },
      },
      DashboardStats: {
        type: "object",
        properties: {
          companies: { type: "integer" },
          plans: { type: "integer" },
          programs: { type: "integer" },
          matchings: { type: "integer" },
          activePrograms: { type: "integer" },
          avgQualityScore: { type: "number", nullable: true },
          activeSubscriptions: { type: "integer" },
          totalRevenue: { type: "number" },
          monthlyRevenue: { type: "number" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
        },
      },
    },
    parameters: {
      pageParam: {
        name: "page",
        in: "query",
        schema: { type: "integer", default: 1 },
        description: "페이지 번호",
      },
      limitParam: {
        name: "limit",
        in: "query",
        schema: { type: "integer", default: 50 },
        description: "페이지당 항목 수",
      },
      searchParam: {
        name: "search",
        in: "query",
        schema: { type: "string" },
        description: "검색어",
      },
    },
  },
  paths: {
    // ─── Auth ─────────────────────────────────────
    "/auth/callback": {
      get: {
        tags: ["Auth"],
        summary: "OAuth 콜백",
        description: "Supabase OAuth 인증 콜백 (리다이렉트)",
        responses: { "302": { description: "인증 후 리다이렉트" } },
      },
    },
    "/auth/signout": {
      post: {
        tags: ["Auth"],
        summary: "로그아웃",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "로그아웃 성공" } },
      },
    },

    // ─── Company ──────────────────────────────────
    "/company": {
      get: {
        tags: ["Company"],
        summary: "기업 정보 조회",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "기업 정보",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Company" } } },
          },
        },
      },
      put: {
        tags: ["Company"],
        summary: "기업 정보 수정",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { "application/json": { schema: { $ref: "#/components/schemas/Company" } } },
        },
        responses: { "200": { description: "수정 완료" } },
      },
    },
    "/company/interview": {
      post: {
        tags: ["Company"],
        summary: "AI 기업 인터뷰",
        description: "AI와 대화하며 기업 정보를 구조화",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "인터뷰 결과" } },
      },
    },

    // ─── Plans ────────────────────────────────────
    "/plans": {
      get: {
        tags: ["Plans"],
        summary: "사업계획서 목록",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "계획서 목록",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    plans: { type: "array", items: { $ref: "#/components/schemas/Plan" } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Plans"],
        summary: "사업계획서 생성",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  program_id: { type: "string", format: "uuid" },
                },
                required: ["title"],
              },
            },
          },
        },
        responses: { "201": { description: "생성 완료" } },
      },
    },
    "/plans/{id}": {
      get: {
        tags: ["Plans"],
        summary: "사업계획서 상세",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            content: { "application/json": { schema: { $ref: "#/components/schemas/Plan" } } },
          },
        },
      },
    },
    "/plans/{id}/generate": {
      post: {
        tags: ["Plans"],
        summary: "AI 사업계획서 생성",
        description: "AI가 기업 정보와 프로그램 매칭 기반으로 사업계획서 섹션 자동 생성",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "생성 시작됨 (스트리밍)" },
          "429": { description: "Rate limit 초과" },
        },
      },
    },
    "/plans/{id}/sections/{sId}": {
      patch: {
        tags: ["Plans"],
        summary: "섹션 내용 수정",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "sId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object", properties: { content: { type: "string" } } } } },
        },
        responses: { "200": { description: "수정 완료" } },
      },
    },
    "/plans/{id}/sections/{sId}/regenerate": {
      post: {
        tags: ["Plans"],
        summary: "섹션 AI 재생성",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "sId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: { "200": { description: "재생성 완료" } },
      },
    },
    "/plans/{id}/export": {
      post: {
        tags: ["Plans"],
        summary: "사업계획서 내보내기",
        description: "DOCX, PDF, Markdown 형식으로 다운로드",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { format: { type: "string", enum: ["docx", "pdf", "md"] } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "파일 다운로드",
            content: {
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {},
              "application/pdf": {},
              "text/markdown": {},
            },
          },
        },
      },
    },

    // ─── IR ───────────────────────────────────────
    "/plans/{id}/ir/generate": {
      post: {
        tags: ["IR"],
        summary: "IR PPT AI 생성",
        description: "사업계획서 기반 IR 피치덱 자동 생성",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "IR 생성 시작됨" },
          "429": { description: "Rate limit 초과" },
        },
      },
    },
    "/plans/{id}/ir/export": {
      post: {
        tags: ["IR"],
        summary: "IR PPTX 다운로드",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "PPTX 파일",
            content: { "application/vnd.openxmlformats-officedocument.presentationml.presentation": {} },
          },
        },
      },
    },

    // ─── Programs ─────────────────────────────────
    "/programs": {
      get: {
        tags: ["Programs"],
        summary: "지원사업 목록",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "source", in: "query", schema: { type: "string" }, description: "출처 필터" },
          { $ref: "#/components/parameters/limitParam" },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    programs: { type: "array", items: { $ref: "#/components/schemas/Program" } },
                    total: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── Matching ─────────────────────────────────
    "/matching": {
      post: {
        tags: ["Matching"],
        summary: "기업-프로그램 매칭",
        description: "AI 기반 기업과 지원사업 매칭 분석",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "매칭 결과" } },
      },
    },

    // ─── Documents ────────────────────────────────
    "/documents": {
      get: {
        tags: ["Documents"],
        summary: "문서 목록",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "문서 목록" } },
      },
      post: {
        tags: ["Documents"],
        summary: "문서 등록",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "등록 완료" } },
      },
    },
    "/documents/upload": {
      post: {
        tags: ["Documents"],
        summary: "문서 업로드",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } },
        },
        responses: { "200": { description: "업로드 완료" } },
      },
    },

    // ─── Payments ─────────────────────────────────
    "/payments/plans": {
      get: {
        tags: ["Payments"],
        summary: "결제 플랜 목록",
        responses: { "200": { description: "플랜 목록" } },
      },
    },
    "/payments/checkout": {
      post: {
        tags: ["Payments"],
        summary: "결제 시작",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "결제 URL" } },
      },
    },
    "/subscriptions": {
      get: {
        tags: ["Payments"],
        summary: "구독 정보 조회",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "구독 정보" } },
      },
    },

    // ─── Admin Dashboard ──────────────────────────
    "/admin/dashboard/stats": {
      get: {
        tags: ["Admin-Dashboard"],
        summary: "대시보드 통계",
        description: "전체 시스템 통계 (기업/계획서/프로그램 수, 매출, 품질평균 등). Redis 5분 캐싱.",
        security: [{ adminCookie: [] }],
        responses: {
          "200": {
            content: { "application/json": { schema: { $ref: "#/components/schemas/DashboardStats" } } },
          },
        },
      },
    },
    "/admin/dashboard/revenue-trend": {
      get: {
        tags: ["Admin-Dashboard"],
        summary: "매출 추이",
        security: [{ adminCookie: [] }],
        responses: { "200": { description: "월별 매출 추이" } },
      },
    },
    "/admin/dashboard/user-growth": {
      get: {
        tags: ["Admin-Dashboard"],
        summary: "사용자 성장 추이",
        security: [{ adminCookie: [] }],
        responses: { "200": { description: "월별 가입자 추이" } },
      },
    },

    // ─── Admin Plans ──────────────────────────────
    "/admin/plans": {
      get: {
        tags: ["Admin-Plans"],
        summary: "사업계획서 목록 (관리자)",
        description: "필터/정렬/검색/페이지네이션 지원. 품질등급별 통계 포함.",
        security: [{ adminCookie: [] }],
        parameters: [
          { $ref: "#/components/parameters/pageParam" },
          { $ref: "#/components/parameters/limitParam" },
          { $ref: "#/components/parameters/searchParam" },
          { name: "status", in: "query", schema: { type: "string", enum: ["draft", "generating", "completed", "error"] } },
          { name: "quality", in: "query", schema: { type: "string", enum: ["high", "medium", "low"] }, description: "품질등급: high(80+)/medium(60-79)/low(<60)" },
          { name: "sort", in: "query", schema: { type: "string", enum: ["created_at", "quality", "match_score"] } },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    plans: { type: "array", items: { $ref: "#/components/schemas/Plan" } },
                    total: { type: "integer" },
                    stats: {
                      type: "object",
                      properties: {
                        total: { type: "integer" },
                        completed: { type: "integer" },
                        avgQuality: { type: "number" },
                        high: { type: "integer" },
                        medium: { type: "integer" },
                        low: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/admin/plans/{id}": {
      get: {
        tags: ["Admin-Plans"],
        summary: "계획서 상세 (관리자)",
        description: "섹션 미리보기, 품질 점수 상세, 매칭 정보, IR 프레젠테이션 포함",
        security: [{ adminCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "계획서 상세" } },
      },
    },
    "/admin/plans/{id}/export": {
      get: {
        tags: ["Admin-Plans"],
        summary: "계획서 내보내기 (관리자)",
        security: [{ adminCookie: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "format", in: "query", schema: { type: "string", enum: ["docx", "pdf", "md"], default: "md" } },
        ],
        responses: { "200": { description: "파일 다운로드" } },
      },
    },

    // ─── Admin IR ─────────────────────────────────
    "/admin/ir": {
      get: {
        tags: ["Admin-IR"],
        summary: "IR 목록 (관리자)",
        security: [{ adminCookie: [] }],
        parameters: [
          { $ref: "#/components/parameters/pageParam" },
          { $ref: "#/components/parameters/limitParam" },
          { $ref: "#/components/parameters/searchParam" },
          { name: "quality", in: "query", schema: { type: "string", enum: ["high", "medium", "low"] } },
          { name: "template", in: "query", schema: { type: "string", enum: ["minimal", "tech", "classic"] } },
        ],
        responses: { "200": { description: "IR 목록 + 통계" } },
      },
    },
    "/admin/ir/{id}/export": {
      get: {
        tags: ["Admin-IR"],
        summary: "IR PPTX 다운로드 (관리자)",
        security: [{ adminCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "PPTX 파일" } },
      },
    },

    // ─── Admin Programs ───────────────────────────
    "/admin/programs": {
      get: {
        tags: ["Admin-Programs"],
        summary: "프로그램 목록 (관리자)",
        description: "필터/정렬/검색/페이지네이션. 기관 목록 Redis 1시간 캐싱.",
        security: [{ adminCookie: [] }],
        parameters: [
          { $ref: "#/components/parameters/pageParam" },
          { $ref: "#/components/parameters/limitParam" },
          { $ref: "#/components/parameters/searchParam" },
          { name: "source", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["active", "expired", "upcoming"] } },
          { name: "institution", in: "query", schema: { type: "string" } },
          { name: "sort", in: "query", schema: { type: "string", default: "collected_at" } },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "desc" } },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    programs: { type: "array", items: { $ref: "#/components/schemas/Program" } },
                    total: { type: "integer" },
                    institutions: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Admin-Programs"],
        summary: "프로그램 수집 트리거",
        security: [{ adminCookie: [] }],
        responses: { "200": { description: "수집 시작됨" } },
      },
    },
    "/admin/programs/{id}": {
      get: {
        tags: ["Admin-Programs"],
        summary: "프로그램 상세",
        security: [{ adminCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "프로그램 상세" } },
      },
      patch: {
        tags: ["Admin-Programs"],
        summary: "프로그램 수정",
        security: [{ adminCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "수정 완료" } },
      },
      delete: {
        tags: ["Admin-Programs"],
        summary: "프로그램 삭제",
        security: [{ adminCookie: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "204": { description: "삭제 완료" } },
      },
    },

    // ─── Admin Users ──────────────────────────────
    "/admin/users": {
      get: {
        tags: ["Admin-Users"],
        summary: "사용자 목록",
        security: [{ adminCookie: [] }],
        parameters: [
          { $ref: "#/components/parameters/pageParam" },
          { $ref: "#/components/parameters/limitParam" },
          { $ref: "#/components/parameters/searchParam" },
        ],
        responses: { "200": { description: "사용자 목록" } },
      },
    },

    // ─── Admin Companies ──────────────────────────
    "/admin/companies": {
      get: {
        tags: ["Admin"],
        summary: "기업 목록 (관리자)",
        security: [{ adminCookie: [] }],
        responses: { "200": { description: "기업 목록" } },
      },
    },

    // ─── Admin Quality ────────────────────────────
    "/admin/quality/scores": {
      get: {
        tags: ["Admin-Quality"],
        summary: "품질 점수 목록",
        security: [{ adminCookie: [] }],
        responses: { "200": { description: "품질 점수 목록" } },
      },
      post: {
        tags: ["Admin-Quality"],
        summary: "품질 평가 실행",
        security: [{ adminCookie: [] }],
        responses: { "200": { description: "평가 결과" } },
      },
    },
    "/admin/quality/patterns": {
      get: {
        tags: ["Admin-Quality"],
        summary: "선정 패턴 목록",
        description: "DB에 저장된 winning_patterns 조회. Redis 5분 캐싱.",
        security: [{ adminCookie: [] }],
        responses: { "200": { description: "패턴 목록" } },
      },
      put: {
        tags: ["Admin-Quality"],
        summary: "선정 패턴 수정",
        security: [{ adminCookie: [] }],
        responses: { "200": { description: "수정 완료" } },
      },
    },

    // ─── Admin Matchings ──────────────────────────
    "/admin/matchings": {
      get: {
        tags: ["Admin"],
        summary: "매칭 결과 목록 (관리자)",
        security: [{ adminCookie: [] }],
        responses: { "200": { description: "매칭 결과 목록" } },
      },
    },

    // ─── Admin Auth ───────────────────────────────
    "/admin/auth": {
      post: {
        tags: ["Admin"],
        summary: "관리자 로그인",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  password: { type: "string" },
                },
                required: ["password"],
              },
            },
          },
        },
        responses: {
          "200": { description: "로그인 성공 (HMAC 쿠키 설정)" },
          "401": { description: "비밀번호 불일치" },
        },
      },
      delete: {
        tags: ["Admin"],
        summary: "관리자 로그아웃",
        responses: { "200": { description: "로그아웃 (쿠키 삭제)" } },
      },
    },

    // ─── Admin References ─────────────────────────
    "/admin/references": {
      get: {
        tags: ["Admin"],
        summary: "참조문서 목록",
        security: [{ adminCookie: [] }],
        responses: { "200": { description: "참조문서 목록" } },
      },
      post: {
        tags: ["Admin"],
        summary: "참조문서 등록",
        security: [{ adminCookie: [] }],
        responses: { "201": { description: "등록 완료" } },
      },
    },

    // ─── Admin System ─────────────────────────────
    "/admin/system/status": {
      get: {
        tags: ["Admin"],
        summary: "시스템 상태",
        description: "DB 연결, Redis, 외부 API 상태 확인",
        security: [{ adminCookie: [] }],
        responses: { "200": { description: "시스템 상태" } },
      },
    },
  },
};
