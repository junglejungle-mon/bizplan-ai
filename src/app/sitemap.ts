import { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://bizplanai.co.kr").trim().replace(/\/$/, "");
  const baseUrl = base + "/";

  // 정적 페이지
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/pricing/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/faq/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${base}/contact/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/login/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/signup/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/terms/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${base}/privacy/`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // 동적 페이지: 정부지원사업 (공개 접근 가능)
  let programPages: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAdminClient();
    const { data: programs } = await supabase
      .from("programs")
      .select("id, collected_at")
      .order("collected_at", { ascending: false })
      .limit(500);

    if (programs) {
      programPages = programs.map((p) => ({
        url: `${base}/programs/${p.id}/`,
        lastModified: new Date(p.collected_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    }
  } catch {
    // DB 연결 실패 시 정적 페이지만 반환
  }

  return [...staticPages, ...programPages];
}
