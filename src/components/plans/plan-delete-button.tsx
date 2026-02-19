"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";

interface PlanDeleteButtonProps {
  planId: string;
  planTitle: string;
}

export function PlanDeleteButton({ planId, planTitle }: PlanDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `"${planTitle}" 사업계획서를 삭제하시겠습니까?\n\n관련 IR PPT도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "삭제 중 오류가 발생했습니다");
        return;
      }
      router.push("/plans");
      router.refresh();
    } catch {
      alert("네트워크 오류가 발생했습니다");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      className="gap-1 text-gray-400 hover:text-red-600 hover:bg-red-50"
      disabled={isDeleting}
      onClick={handleDelete}
    >
      {isDeleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">{isDeleting ? "삭제 중..." : "삭제"}</span>
    </Button>
  );
}
