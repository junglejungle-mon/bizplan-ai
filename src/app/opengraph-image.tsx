import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BizPlan AI — AI 사업계획서 자동 작성 서비스";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* 상단 장식 라인 */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)",
            display: "flex",
          }}
        />

        {/* 로고 영역 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              color: "white",
              fontWeight: 700,
            }}
          >
            B
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "white",
              display: "flex",
            }}
          >
            BizPlan AI
          </div>
        </div>

        {/* 타이틀 */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: "#e2e8f0",
            marginBottom: 16,
            display: "flex",
          }}
        >
          AI 사업계획서 자동 작성 서비스
        </div>

        {/* 서브 텍스트 */}
        <div
          style={{
            fontSize: 22,
            color: "#94a3b8",
            display: "flex",
            gap: 24,
            alignItems: "center",
          }}
        >
          <span>정부지원사업 AI 매칭</span>
          <span style={{ color: "#3b82f6" }}>|</span>
          <span>사업계획서 자동 작성</span>
          <span style={{ color: "#3b82f6" }}>|</span>
          <span>IR PPT 생성</span>
        </div>

        {/* 하단 URL */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 18,
            color: "#64748b",
            display: "flex",
          }}
        >
          bizplanai.co.kr
        </div>
      </div>
    ),
    { ...size }
  );
}
