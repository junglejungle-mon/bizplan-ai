"use client";

import { useEffect } from "react";
import { captureUTM } from "@/lib/utm";

/**
 * UTM 파라미터 자동 캡처 컴포넌트
 * 모든 페이지에서 실행되어 최초 유입 시 UTM 데이터를 sessionStorage에 저장
 */
export function UTMCapture() {
  useEffect(() => {
    captureUTM();
  }, []);

  return null;
}
