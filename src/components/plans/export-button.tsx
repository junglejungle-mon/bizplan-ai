"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileText, FileType } from "lucide-react";

interface ExportButtonProps {
  planId: string;
}

export function ExportButton({ planId }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = async (format: "md" | "docx" | "pdf") => {
    setExporting(true);
    setShowMenu(false);

    try {
      const response = await fetch(`/api/plans/${planId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "내보내기 실패");
      }

      // 파일 다운로드 (md, docx 모두 동일 처리)
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const extMap = { md: "사업계획서.md", docx: "사업계획서.docx", pdf: "사업계획서.pdf" };
      const defaultName = extMap[format] || "사업계획서.md";
      a.download = filenameMatch
        ? decodeURIComponent(filenameMatch[1])
        : defaultName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(`내보내기 오류: ${err}`);
    }

    setExporting(false);
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        내보내기
      </Button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-lg border bg-white shadow-lg py-1">
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
              onClick={() => handleExport("md")}
            >
              <FileText className="h-4 w-4 text-gray-500" />
              마크다운 (.md)
            </button>
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
              onClick={() => handleExport("docx")}
            >
              <FileType className="h-4 w-4 text-blue-500" />
              DOCX (.docx)
            </button>
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
              onClick={() => handleExport("pdf")}
            >
              <FileType className="h-4 w-4 text-red-500" />
              PDF (.pdf)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
