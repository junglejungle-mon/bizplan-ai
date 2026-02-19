"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API 문서</h1>
        <p className="text-gray-600 mt-1">
          BizPlan AI 전체 API 엔드포인트 문서 (OpenAPI 3.0)
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-0 overflow-hidden">
        <SwaggerUI url="/api/admin/openapi" />
      </div>
    </div>
  );
}
