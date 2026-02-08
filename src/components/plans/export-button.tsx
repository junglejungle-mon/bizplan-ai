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

  const handleExport = async (format: "md" | "docx") => {
    setExporting(true);
    setShowMenu(false);

    try {
      const response = await fetch(`/api/plans/${planId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });

      if (!response.ok) throw new Error("내보내기 실패");

      if (format === "md") {
        // 마크다운 파일 다운로드
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const disposition = response.headers.get("Content-Disposition");
        const filenameMatch = disposition?.match(/filename="(.+)"/);
        a.download = filenameMatch
          ? decodeURIComponent(filenameMatch[1])
          : "사업계획서.md";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        // DOCX/기타 미지원 포맷
        const data = await response.json();
        alert(data.message || "해당 형식은 아직 지원되지 않습니다.");
      }
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
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
              disabled
            >
              <FileType className="h-4 w-4" />
              DOCX (준비중)
            </button>
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
              disabled
            >
              <FileType className="h-4 w-4" />
              PDF (준비중)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
