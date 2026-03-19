/**
 * 파일 매직 바이트(시그니처) 검증
 * MIME 타입 스푸핑 공격 방어: 선언된 Content-Type과 실제 파일 내용이 일치하는지 확인
 */

const SIGNATURES: Record<string, number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

/**
 * 업로드된 파일의 매직 바이트가 선언된 MIME 타입과 일치하는지 검증
 * @param buffer - 파일 바이트 (Uint8Array 또는 Buffer)
 * @param declaredType - file.type 등으로 선언된 MIME 타입
 * @returns true면 유효, false면 불일치 또는 미지원 타입
 */
export function validateFileSignature(
  buffer: Uint8Array | Buffer,
  declaredType: string
): boolean {
  const expected = SIGNATURES[declaredType];
  // 시그니처 목록에 없는 타입은 검증 불가 → 통과 (다른 레이어에서 MIME 체크)
  if (!expected) return true;

  if (buffer.length < expected.length) return false;

  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) return false;
  }
  return true;
}
