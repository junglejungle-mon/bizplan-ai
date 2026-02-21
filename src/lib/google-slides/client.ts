/**
 * Google Slides API 클라이언트
 * Service Account 인증 기반
 */

import { google, slides_v1, drive_v3 } from "googleapis";
import { JWT } from "google-auth-library";

let authClient: JWT | null = null;

function getAuth(): JWT {
  if (authClient) return authClient;

  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "Google Slides 환경변수가 설정되지 않았습니다 (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)"
    );
  }

  authClient = new JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  return authClient;
}

export function getSlidesClient(): slides_v1.Slides {
  return google.slides({ version: "v1", auth: getAuth() });
}

export function getDriveClient(): drive_v3.Drive {
  return google.drive({ version: "v3", auth: getAuth() });
}

/**
 * Google Slides 프레젠테이션 생성
 */
export async function createPresentation(
  title: string
): Promise<{ presentationId: string; url: string }> {
  const slides = getSlidesClient();
  const res = await slides.presentations.create({
    requestBody: { title },
  });

  const presentationId = res.data.presentationId!;
  return {
    presentationId,
    url: `https://docs.google.com/presentation/d/${presentationId}/edit`,
  };
}

/**
 * 프레젠테이션에 batch update 실행
 */
export async function batchUpdate(
  presentationId: string,
  requests: slides_v1.Schema$Request[]
): Promise<slides_v1.Schema$BatchUpdatePresentationResponse> {
  const slides = getSlidesClient();
  const res = await slides.presentations.batchUpdate({
    presentationId,
    requestBody: { requests },
  });
  return res.data;
}

/**
 * 프레젠테이션을 PPTX로 내보내기
 */
export async function exportAsPptx(presentationId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const res = await drive.files.export(
    {
      fileId: presentationId,
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/**
 * 프레젠테이션을 PDF로 내보내기
 */
export async function exportAsPdf(presentationId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const res = await drive.files.export(
    {
      fileId: presentationId,
      mimeType: "application/pdf",
    },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

/**
 * 프레젠테이션 공유 설정 (누구나 보기 가능)
 */
export async function sharePresentation(
  presentationId: string,
  role: "reader" | "writer" = "reader"
): Promise<void> {
  const drive = getDriveClient();
  await drive.permissions.create({
    fileId: presentationId,
    requestBody: {
      role,
      type: "anyone",
    },
  });
}

/**
 * 프레젠테이션 삭제
 */
export async function deletePresentation(
  presentationId: string
): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId: presentationId });
}

/**
 * Google Slides API 사용 가능 여부 체크
 */
export function isGoogleSlidesEnabled(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
  );
}
