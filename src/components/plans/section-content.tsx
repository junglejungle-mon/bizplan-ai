"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SectionContentProps {
  content: string;
}

export function SectionContent({ content }: SectionContentProps) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-li:text-gray-700 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mt-4 [&>h1]:mb-2 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-2 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mt-2 [&>h3]:mb-1 [&>ul]:my-1 [&>ul]:pl-5 [&>ol]:my-1 [&>ol]:pl-5 [&>p]:my-1 [&_table]:text-sm [&_table]:border-collapse [&_th]:border [&_th]:border-gray-300 [&_th]:px-3 [&_th]:py-1 [&_th]:bg-gray-50 [&_th]:font-medium [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
