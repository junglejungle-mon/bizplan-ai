"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
  receipt_url: string | null;
}

const STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "default" }> = {
  paid: { label: "완료", variant: "success" },
  pending: { label: "대기", variant: "warning" },
  failed: { label: "실패", variant: "destructive" },
  canceled: { label: "취소", variant: "secondary" },
  refunded: { label: "환불", variant: "default" },
};

const METHOD_LABELS: Record<string, string> = {
  CARD: "카드",
  TRANSFER: "계좌이체",
  VIRTUAL_ACCOUNT: "가상계좌",
  MOBILE: "휴대폰",
  KAKAOPAY: "카카오페이",
  NAVERPAY: "네이버페이",
  TOSSPAY: "토스페이",
  SAMSUNG_PAY: "삼성페이",
};

export function PaymentHistory() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  async function fetchPayments() {
    try {
      const res = await fetch("/api/payments/history");
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
      } else {
        setPayments([]);
      }
    } catch (error) {
      console.error("결제 이력 조회 실패:", error);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>결제 내역</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-gray-100 rounded" />
            <div className="h-10 bg-gray-100 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>결제 내역</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <div className="text-center py-8">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">결제 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">날짜</th>
                  <th className="text-left py-2 font-medium text-gray-500">결제수단</th>
                  <th className="text-right py-2 font-medium text-gray-500">금액</th>
                  <th className="text-center py-2 font-medium text-gray-500">상태</th>
                  <th className="text-right py-2 font-medium text-gray-500">영수증</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((payment) => {
                  const statusInfo = STATUS_MAP[payment.status] || {
                    label: payment.status,
                    variant: "secondary" as const,
                  };
                  const methodLabel =
                    METHOD_LABELS[payment.payment_method || ""] ||
                    payment.payment_method ||
                    "-";

                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="py-3 text-gray-700">
                        {payment.paid_at
                          ? new Date(payment.paid_at).toLocaleDateString("ko-KR")
                          : new Date(payment.created_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="py-3 text-gray-600">{methodLabel}</td>
                      <td className="py-3 text-right font-medium text-gray-900">
                        {payment.amount.toLocaleString()}원
                      </td>
                      <td className="py-3 text-center">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        {payment.receipt_url ? (
                          <a
                            href={payment.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-xs"
                          >
                            영수증
                          </a>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
