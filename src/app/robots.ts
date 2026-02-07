import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/", "/plans/", "/programs/", "/documents/", "/company/", "/settings/", "/onboarding/"],
    },
    sitemap: "https://bizplan-ai.vercel.app/sitemap.xml",
  };
}
