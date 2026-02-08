"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface DocumentUploadButtonProps {
  documentType: string;
  source: string;
  documentName: string;
  onUploadComplete?: () => void;
}

export function DocumentUploadButton({
  documentType,
  source,
  documentName,
  onUploadComplete,
}: DocumentUploadButtonProps) {
  const [status, setStatus] = useState<
    "idle" | "uploading" | "extracting" | "done" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setErrorMessage("");

    try {
      // 1. 파일 업로드
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", documentType);
      formData.append("source", source);

      const uploadRes = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "업로드 실패");
      }

      const { document } = await uploadRes.json();

      // 2. OCR 추출
      setStatus("extracting");

      const extractRes = await fetch("/api/documents/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: document.id }),
      });

      if (!extractRes.ok) {
        const err = await extractRes.json();
        throw new Error(err.error || "데이터 추출 실패");
      }

      setStatus("done");
      onUploadComplete?.();

      // 3초 후 페이지 새로고침
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      setStatus("error");
      setErrorMessage(String(error));
      console.error("[Upload]", error);
    } finally {
      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (status === "done") {
    return (
      <div className="flex items-center gap-1 text-green-600 text-xs">
        <CheckCircle2 className="h-3 w-3" />
        <span>완료!</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-red-600"
          onClick={handleClick}
        >
          <AlertCircle className="h-3 w-3" /> 재시도
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={handleClick}
        disabled={status === "uploading" || status === "extracting"}
      >
        {status === "uploading" ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> 업로드 중...
          </>
        ) : status === "extracting" ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> 분석 중...
          </>
        ) : (
          <>
            <Upload className="h-3 w-3" /> 업로드
          </>
        )}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
