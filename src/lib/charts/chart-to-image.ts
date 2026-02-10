/**
 * SVG → PNG 변환 (sharp)
 * 2x 해상도 렌더링, 병렬 처리 (동시 8개 제한)
 */

import sharp from "sharp";
import { renderChartToSvg, getChartSize, ChartDataItem } from "./svg-renderer";

export interface ChartImageResult {
  pngBuffer: Buffer;
  width: number;
  height: number;
  chartType: string;
  title: string;
}

/**
 * 단일 차트 → PNG 이미지 변환
 */
export async function chartToImage(
  chart: ChartDataItem,
  templateType?: string
): Promise<ChartImageResult> {
  const size = getChartSize(chart.type);
  const scale = 2; // 2x 해상도 (인쇄 품질)

  const svgString = renderChartToSvg(chart, templateType);
  const svgBuffer = Buffer.from(svgString, "utf-8");

  const pngBuffer = await sharp(svgBuffer, { density: 72 * scale })
    .resize(size.width * scale, size.height * scale)
    .png({ quality: 90 })
    .toBuffer();

  return {
    pngBuffer,
    width: size.width,
    height: size.height,
    chartType: chart.type,
    title: chart.title,
  };
}

/**
 * 실패 시 placeholder 이미지 반환
 */
async function createPlaceholder(
  chart: ChartDataItem,
  error: unknown
): Promise<ChartImageResult | null> {
  console.warn(`[chart-to-image] ${chart.type} "${chart.title}" 렌더링 실패:`, error);

  try {
    const size = getChartSize(chart.type);
    const w = size.width * 2;
    const h = size.height * 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="#F8FAFC" rx="8"/>
      <text x="${w / 2}" y="${h / 2}" text-anchor="middle" font-size="24" fill="#94A3B8">[차트 렌더링 실패]</text>
    </svg>`;

    const pngBuffer = await sharp(Buffer.from(svg, "utf-8")).png().toBuffer();
    return { pngBuffer, width: size.width, height: size.height, chartType: chart.type, title: chart.title };
  } catch {
    return null;
  }
}

/**
 * 섹션별 차트 데이터 → 섹션별 PNG 이미지 배열
 * Promise.all 병렬 처리 (동시 8개 제한)
 */
export async function chartsToImages(
  chartsBySection: Record<string, ChartDataItem[]>,
  templateType?: string
): Promise<Record<string, ChartImageResult[]>> {
  const result: Record<string, ChartImageResult[]> = {};

  // 모든 차트를 플랫하게 수집
  const tasks: Array<{ sectionKey: string; chart: ChartDataItem; index: number }> = [];
  for (const [sectionKey, charts] of Object.entries(chartsBySection)) {
    result[sectionKey] = [];
    charts.forEach((chart, index) => {
      tasks.push({ sectionKey, chart, index });
    });
  }

  // 동시 8개 제한 병렬 처리
  const concurrency = 8;
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async ({ sectionKey, chart }) => {
        try {
          const img = await chartToImage(chart, templateType);
          return { sectionKey, img };
        } catch (error) {
          const placeholder = await createPlaceholder(chart, error);
          return placeholder ? { sectionKey, img: placeholder } : null;
        }
      })
    );

    for (const item of batchResults) {
      if (item) {
        result[item.sectionKey].push(item.img);
      }
    }
  }

  return result;
}
