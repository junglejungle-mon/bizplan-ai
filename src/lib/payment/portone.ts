/**
 * PortOne V2 결제 유틸리티
 * - REST API v2 호출 (결제 조회/취소)
 * - 웹훅 서명 검증 (Web Crypto API — Edge 호환)
 */

// ── Types ──

export interface PortOnePayment {
  id: string;
  status: string;
  transactionId?: string;
  merchantId?: string;
  storeId?: string;
  method?: {
    type: string;
    card?: {
      name?: string;
      number?: string;
      brand?: string;
    };
    easyPay?: {
      provider?: string;
    };
  };
  channel?: {
    type: string;
    id: string;
    key: string;
    name: string;
    pgProvider: string;
  };
  amount: {
    total: number;
    paid: number;
    cancelled: number;
    currency: string;
  };
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
  paidAt?: string;
  cancelledAt?: string;
  failedAt?: string;
  receiptUrl?: string;
}

export interface PortOneError {
  type: string;
  message: string;
}

// ── PortOne REST API v2 ──

const PORTONE_API_BASE = "https://api.portone.io";

function getApiSecret(): string {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) throw new Error("PORTONE_API_SECRET 환경변수가 설정되지 않았습니다.");
  return secret;
}

/**
 * PortOne API 호출 헬퍼
 */
async function portoneRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${PORTONE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `PortOne ${getApiSecret()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`PortOne API 오류 [${res.status}]: ${error.message || JSON.stringify(error)}`);
  }

  return res.json() as Promise<T>;
}

/**
 * 결제 내역 조회
 */
export async function getPayment(paymentId: string): Promise<PortOnePayment> {
  return portoneRequest<PortOnePayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

/**
 * 결제 취소 (전액 환불)
 */
export async function cancelPayment(
  paymentId: string,
  reason: string
): Promise<{ cancellation: { cancelledAt: string } }> {
  return portoneRequest(`/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/**
 * 결제 금액 검증
 */
export function verifyPaymentAmount(
  payment: PortOnePayment,
  expectedAmount: number,
  expectedCurrency: string = "KRW"
): boolean {
  return (
    payment.status === "PAID" &&
    payment.amount.total === expectedAmount &&
    payment.amount.currency === expectedCurrency
  );
}

// ── Webhook 서명 검증 (Web Crypto API) ──

/**
 * PortOne 웹훅 서명 검증
 * Header: webhook-id, webhook-timestamp, webhook-signature
 */
export async function verifyWebhookSignature(
  body: string,
  headers: {
    "webhook-id": string;
    "webhook-timestamp": string;
    "webhook-signature": string;
  }
): Promise<boolean> {
  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[portone] PORTONE_WEBHOOK_SECRET 미설정 — 웹훅 거부");
    return false;
  }

  try {
    const webhookId = headers["webhook-id"];
    const timestamp = headers["webhook-timestamp"];
    const signatures = headers["webhook-signature"];

    // 타임스탬프 검증 (5분 이내)
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (Math.abs(now - ts) > 300) {
      console.warn("[portone] 웹훅 타임스탬프 만료");
      return false;
    }

    // 서명 생성 및 비교
    const message = `${webhookId}.${timestamp}.${body}`;
    // secret은 base64 인코딩된 형태, whsec_ 접두사 제거
    const secretBytes = base64ToUint8Array(secret.replace("whsec_", ""));

    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes.buffer as ArrayBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const msgBuffer = new TextEncoder().encode(message);
    const sig = await crypto.subtle.sign("HMAC", key, msgBuffer.buffer as ArrayBuffer);
    const expectedSig = uint8ArrayToBase64(new Uint8Array(sig));

    // 여러 서명 중 하나라도 일치하면 OK
    const providedSigs = signatures.split(" ");
    return providedSigs.some((s) => {
      const sigValue = s.startsWith("v1,") ? s.slice(3) : s;
      return constantTimeEqual(sigValue, expectedSig);
    });
  } catch (error) {
    console.error("[portone] 웹훅 서명 검증 실패:", error);
    return false;
  }
}

// ── 유틸리티 ──

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ── 결제 파라미터 생성 (클라이언트 전달용) ──

export interface CheckoutParams {
  storeId: string;
  paymentId: string;
  orderName: string;
  totalAmount: number;
  currency: string;
  channelKey?: string;
  payMethod?: string;
  noticeUrls?: string[];
  customer?: {
    customerId?: string;
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  };
  redirectUrl?: string;
}

/**
 * 클라이언트에 전달할 결제 파라미터 생성
 */
export function buildCheckoutParams(params: {
  paymentId: string;
  planName: string;
  amount: number;
  userId: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
}): CheckoutParams {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  if (!storeId) throw new Error("NEXT_PUBLIC_PORTONE_STORE_ID 미설정");

  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

  return {
    storeId,
    paymentId: params.paymentId,
    orderName: `BizPlan AI - ${params.planName}`,
    totalAmount: params.amount,
    currency: "KRW",
    channelKey,
    noticeUrls: [`${appUrl.trim()}/api/payments/webhook`],
    customer: {
      customerId: params.userId,
      fullName: params.userName,
      email: params.userEmail,
      phoneNumber: params.userPhone,
    },
    redirectUrl: `${appUrl.trim()}/settings?payment=complete`,
  };
}
