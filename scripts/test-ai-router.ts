#!/usr/bin/env npx tsx
/**
 * AI Router 동작 테스트
 *
 * 사용:
 *   npx tsx scripts/test-ai-router.ts
 *   AI_DEBUG=1 npx tsx scripts/test-ai-router.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: process.env.HOME + '/.env.apis' });

import {
  callAI,
  callAIJson,
  healthCheck,
  getAIStats,
} from '../src/lib/ai';

async function main() {
  console.log('🔧 AI Router 테스트\n');

  // 1. 헬스체크
  console.log('1. 헬스체크...');
  const health = await healthCheck();
  for (const [name, ok] of Object.entries(health)) {
    console.log(`   ${ok ? '✅' : '❌'} ${name}`);
  }
  console.log();

  // 2. 텍스트 호출
  console.log('2. 텍스트 호출 (Claude CLI 우선)...');
  try {
    const result = await callAI('1 + 1 = ? 숫자만 답해.', {
      model: 'haiku',
      timeoutMs: 30_000,
      context: 'simple-math',
    });
    console.log(`   ✅ Source: ${result.source}`);
    console.log(`   ✅ Model: ${result.model}`);
    console.log(`   ✅ Output: ${result.output.slice(0, 100)}`);
    console.log(`   ✅ Duration: ${result.durationMs}ms`);
  } catch (e) {
    console.error('   ❌ 실패:', e instanceof Error ? e.message : e);
  }
  console.log();

  // 3. JSON 호출
  console.log('3. JSON 호출...');
  try {
    const { data, result } = await callAIJson<{ answer: number; reason: string }>(
      '한국 정부지원사업 중 R&D 사업 수는 대략 몇 개? JSON 형식: {"answer": number, "reason": string}',
      {
        model: 'sonnet',
        timeoutMs: 60_000,
        context: 'json-test',
      }
    );
    console.log(`   ✅ Source: ${result.source}`);
    console.log(`   ✅ Parsed:`, data);
  } catch (e) {
    console.error('   ❌ 실패:', e instanceof Error ? e.message : e);
  }
  console.log();

  // 4. 통계
  console.log('4. 통계:');
  const stats = getAIStats();
  console.log(`   총 호출: ${stats.totalCalls}`);
  console.log(`   provider별:`, stats.byProvider);
  if (stats.failures.length > 0) {
    console.log(`   실패: ${stats.failures.length}건`);
    stats.failures.forEach((f) =>
      console.log(`     - ${f.provider}: ${f.error.slice(0, 100)}`)
    );
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
