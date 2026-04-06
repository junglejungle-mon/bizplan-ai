#!/usr/bin/env npx tsx
/**
 * 골든 케이스 회귀 테스트
 *
 * 사용:
 *   npx tsx scripts/run-golden-cases.ts
 *   AI_CACHE=0 npx tsx scripts/run-golden-cases.ts  (캐시 끄고 fresh)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { callAI } from '../src/lib/ai';
import { clearCache } from '../src/lib/ai/cache';
import type { AICallOptions } from '../src/lib/ai/types';

interface GoldenCase {
  id: string;
  name: string;
  prompt: string;
  options: AICallOptions;
  expectations: {
    minLength?: number;
    mustContain?: string[];
    mustNotContain?: string[];
    isJson?: boolean;
    jsonKeys?: string[];
    matchPattern?: string;
    scoreRange?: [number, number];
    secondCallShouldBeCached?: boolean;
    secondCallMaxMs?: number;
  };
}

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  failures: string[];
  durationMs: number;
  output: string;
}

async function runCase(c: GoldenCase): Promise<TestResult> {
  const failures: string[] = [];
  const start = Date.now();

  try {
    // 1차 호출
    const result = await callAI(c.prompt, c.options);
    const output = result.output;

    // 검증 1: 최소 길이
    if (c.expectations.minLength && output.length < c.expectations.minLength) {
      failures.push(`길이 부족: ${output.length} < ${c.expectations.minLength}`);
    }

    // 검증 2: 포함해야 할 문자열
    if (c.expectations.mustContain) {
      for (const must of c.expectations.mustContain) {
        if (!output.includes(must)) {
          failures.push(`누락: "${must}"`);
        }
      }
    }

    // 검증 3: 포함하면 안 되는 문자열
    if (c.expectations.mustNotContain) {
      for (const mustNot of c.expectations.mustNotContain) {
        if (output.toLowerCase().includes(mustNot.toLowerCase())) {
          failures.push(`금지어 포함: "${mustNot}"`);
        }
      }
    }

    // 검증 4: JSON 파싱
    if (c.expectations.isJson) {
      try {
        const cleaned = output.replace(/```json\n?|\n?```/g, '').trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        const jsonText = cleaned.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonText);

        // JSON 키 검증
        if (c.expectations.jsonKeys) {
          for (const key of c.expectations.jsonKeys) {
            if (!(key in parsed)) {
              failures.push(`JSON 키 누락: ${key}`);
            }
          }
        }
      } catch (e) {
        failures.push(`JSON 파싱 실패: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    // 검증 5: 정규식 패턴
    if (c.expectations.matchPattern) {
      const re = new RegExp(c.expectations.matchPattern);
      if (!re.test(output)) {
        failures.push(`패턴 불일치: /${c.expectations.matchPattern}/`);
      }
    }

    // 검증 6: 점수 범위
    if (c.expectations.scoreRange) {
      const match = output.match(/\d+/);
      if (match) {
        const score = parseInt(match[0]);
        const [min, max] = c.expectations.scoreRange;
        if (score < min || score > max) {
          failures.push(`점수 범위 초과: ${score} (${min}~${max})`);
        }
      } else {
        failures.push(`점수 추출 실패`);
      }
    }

    // 검증 7: 캐시 동작 확인
    if (c.expectations.secondCallShouldBeCached) {
      const t = Date.now();
      const result2 = await callAI(c.prompt, c.options);
      const duration2 = Date.now() - t;
      const maxMs = c.expectations.secondCallMaxMs || 100;

      if (duration2 > maxMs) {
        failures.push(`캐시 미스: 2차 호출 ${duration2}ms > ${maxMs}ms`);
      }
      if (result2.output !== output) {
        failures.push(`캐시 결과 불일치`);
      }
    }

    return {
      id: c.id,
      name: c.name,
      passed: failures.length === 0,
      failures,
      durationMs: Date.now() - start,
      output: output.slice(0, 200),
    };
  } catch (e) {
    failures.push(`호출 실패: ${e instanceof Error ? e.message : String(e)}`);
    return {
      id: c.id,
      name: c.name,
      passed: false,
      failures,
      durationMs: Date.now() - start,
      output: '',
    };
  }
}

async function main() {
  const casesPath = path.join(__dirname, '..', '__tests__', 'golden', 'cases.json');
  const data = JSON.parse(fs.readFileSync(casesPath, 'utf-8')) as { cases: GoldenCase[] };

  console.log('🔧 골든 케이스 회귀 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`총 ${data.cases.length}개 케이스\n`);

  // 캐시 끄기 옵션 (fresh 테스트)
  if (process.env.AI_CACHE === '0') {
    console.log('⚠️  AI_CACHE=0 — 캐시 비활성화\n');
    await clearCache();
  }

  const results: TestResult[] = [];
  for (const c of data.cases) {
    process.stdout.write(`▶ ${c.id} ${c.name}... `);
    const r = await runCase(c);
    results.push(r);
    console.log(r.passed ? `✅ ${r.durationMs}ms` : `❌ ${r.durationMs}ms`);
    if (!r.passed) {
      r.failures.forEach((f) => console.log(`    - ${f}`));
      console.log(`    Output: ${r.output.slice(0, 150)}...`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
  console.log(`결과: ${passed}/${results.length} 통과 (${failed} 실패)`);
  console.log(`총 소요: ${(totalDuration / 1000).toFixed(1)}초`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
