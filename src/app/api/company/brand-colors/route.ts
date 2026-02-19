import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";

/**
 * POST /api/company/brand-colors
 * 로고 이미지에서 브랜드 색상 자동 추출
 * Body: FormData with "logo" file
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const logoFile = formData.get("logo") as File | null;

    if (!logoFile) {
      return NextResponse.json({ error: "로고 파일이 필요합니다" }, { status: 400 });
    }

    // 파일 크기 체크 (5MB)
    if (logoFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기가 5MB를 초과합니다" }, { status: 400 });
    }

    const buffer = Buffer.from(await logoFile.arrayBuffer());

    // sharp로 이미지 리사이즈 + 색상 통계 추출
    const { dominant, channels } = await sharp(buffer)
      .resize(100, 100, { fit: "cover" })
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data, info }) => {
        const pixels: [number, number, number][] = [];
        const step = info.channels;

        for (let i = 0; i < data.length; i += step) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // 너무 하양(배경)이나 너무 검정은 제외
          const brightness = (r + g + b) / 3;
          if (brightness > 240 || brightness < 15) continue;

          pixels.push([r, g, b]);
        }

        // K-means 간이 구현 (dominant 5색 추출)
        const colors = extractDominantColors(pixels, 5);

        return {
          dominant: colors[0] || [0, 0, 0],
          channels: colors,
        };
      });

    // RGB → HEX 변환
    const toHex = (rgb: number[]) =>
      rgb.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase();

    const primaryColor = toHex(dominant);
    const paletteColors = channels.map(toHex);

    // 명도 기반 텍스트 색상 결정
    const brightness = (dominant[0] * 299 + dominant[1] * 587 + dominant[2] * 114) / 1000;
    const textOnPrimary = brightness > 128 ? "1A1A2E" : "FFFFFF";

    // 보조색 생성 (primary를 약간 밝게)
    const secondary = dominant.map((c) => Math.min(255, c + 40));
    const accent = findComplementary(dominant);

    const brandColors = {
      primary: primaryColor,
      secondary: toHex(secondary),
      accent: toHex(accent),
      bg: "FFFFFF",
      textDark: brightness > 128 ? primaryColor : "1A1A2E",
      textLight: "6B7280",
      textOnPrimary,
      positive: "22C55E",
      negative: "EF4444",
      chartColors: paletteColors.slice(0, 5),
      palette: paletteColors,
    };

    // 회사 정보에 저장
    const { data: companies } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (companies && companies.length > 0) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminClient = createAdminClient();

      // business_content에 brand_colors 추가 (JSONB 활용)
      const { data: company } = await adminClient
        .from("companies")
        .select("business_content")
        .eq("id", companies[0].id)
        .single();

      let existingContent = (company as any)?.business_content || "";

      // brand_colors JSON을 business_content 앞에 추가
      const brandColorJson = `[BRAND_COLORS]\n${JSON.stringify(brandColors)}\n[/BRAND_COLORS]\n`;

      // 기존 brand_colors 제거 후 새로 추가
      existingContent = existingContent.replace(
        /\[BRAND_COLORS\][\s\S]*?\[\/BRAND_COLORS\]\n?/,
        ""
      );
      existingContent = brandColorJson + existingContent;

      await adminClient
        .from("companies")
        .update({ business_content: existingContent })
        .eq("id", companies[0].id);
    }

    return NextResponse.json({
      success: true,
      brandColors,
    });
  } catch (error) {
    console.error("[BrandColors] 색상 추출 실패:", error);
    return NextResponse.json(
      { error: "색상 추출에 실패했습니다" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/company/brand-colors
 * 저장된 브랜드 색상 조회
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: companies } = await supabase
    .from("companies")
    .select("business_content")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (!companies || companies.length === 0) {
    return NextResponse.json({ brandColors: null });
  }

  const content = (companies[0] as any)?.business_content || "";
  const match = content.match(/\[BRAND_COLORS\]\n([\s\S]*?)\n\[\/BRAND_COLORS\]/);

  if (!match) {
    return NextResponse.json({ brandColors: null });
  }

  try {
    const brandColors = JSON.parse(match[1]);
    return NextResponse.json({ brandColors });
  } catch {
    return NextResponse.json({ brandColors: null });
  }
}

// ===== 색상 추출 유틸리티 =====

/**
 * 간이 K-means 색상 클러스터링
 */
function extractDominantColors(
  pixels: [number, number, number][],
  k: number
): number[][] {
  if (pixels.length === 0) return [[0, 0, 0]];
  if (pixels.length <= k) return pixels.map((p) => [...p]);

  // 초기 중심점 (균등 분할)
  const step = Math.floor(pixels.length / k);
  let centroids = Array.from({ length: k }, (_, i) => [
    ...pixels[Math.min(i * step, pixels.length - 1)],
  ]);

  // 10회 반복
  for (let iter = 0; iter < 10; iter++) {
    const clusters: [number, number, number][][] = Array.from(
      { length: k },
      () => []
    );

    // 할당
    for (const px of pixels) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let c = 0; c < centroids.length; c++) {
        const dist =
          (px[0] - centroids[c][0]) ** 2 +
          (px[1] - centroids[c][1]) ** 2 +
          (px[2] - centroids[c][2]) ** 2;
        if (dist < minDist) {
          minDist = dist;
          minIdx = c;
        }
      }
      clusters[minIdx].push(px);
    }

    // 중심점 업데이트
    centroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i];
      const r = Math.round(cluster.reduce((s, p) => s + p[0], 0) / cluster.length);
      const g = Math.round(cluster.reduce((s, p) => s + p[1], 0) / cluster.length);
      const b = Math.round(cluster.reduce((s, p) => s + p[2], 0) / cluster.length);
      return [r, g, b];
    });
  }

  // 클러스터 크기 순으로 정렬 (가장 많은 색이 dominant)
  const clusterSizes = centroids.map((c, i) => ({
    color: c,
    idx: i,
  }));

  // 채도가 높은 색을 우선 (회색 계열 뒤로)
  clusterSizes.sort((a, b) => {
    const satA = colorSaturation(a.color);
    const satB = colorSaturation(b.color);
    return satB - satA; // 채도 높은 순
  });

  return clusterSizes.map((c) => c.color);
}

function colorSaturation(rgb: number[]): number {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * 보색 계산 (accent color용)
 */
function findComplementary(rgb: number[]): number[] {
  // HSL 변환 후 hue 반전
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;

  if (max !== min) {
    const d = max - min;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  // hue 반전 (보색)
  h = (h + 0.5) % 1;

  // 채도 유지, 명도 약간 조정
  const s = max === 0 ? 0 : (max - min) / max;
  const l = (max + min) / 2;

  // HSL → RGB
  return hslToRgb(h, Math.min(s * 1.2, 1), Math.max(0.4, Math.min(l, 0.6)));
}

function hslToRgb(h: number, s: number, l: number): number[] {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
