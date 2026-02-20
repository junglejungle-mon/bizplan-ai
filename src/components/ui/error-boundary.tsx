"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 에러 발생 시 표시할 제목 */
  title?: string;
  /** 에러 발생 시 표시할 설명 */
  description?: string;
  /** 폴백 UI 커스텀 (title/description 대신 사용) */
  fallback?: ReactNode;
  /** 에러 발생 시 콜백 */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — 런타임 크래시 방지
 *
 * AI 기능 등 예기치 못한 에러로 전체 페이지가 흰 화면이 되는 것을 방지합니다.
 * 에러 발생 시 안전한 fallback UI를 보여주고 재시도 옵션을 제공합니다.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-lg">
                {this.props.title || "오류가 발생했습니다"}
              </CardTitle>
              <CardDescription>
                {this.props.description ||
                  "예기치 못한 오류가 발생했습니다. 다시 시도하거나 대시보드로 이동해주세요."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3 justify-center">
              <Button variant="outline" onClick={this.handleRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                다시 시도
              </Button>
              <Button onClick={this.handleGoHome}>
                대시보드로 이동
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
