/**
 * Claude CLI Provider
 * `claude --print -p` 명령으로 로컬 Claude Max 호출 (무제한)
 *
 * 핵심:
 * - 별도 API 키 불필요 (이미 로그인된 CLI 사용)
 * - stdin 즉시 닫기 (안 그러면 3초 대기)
 * - exit code 0 + non-empty stdout만 성공으로 인정
 */
import { spawn } from 'child_process';
import type { AIProvider, AICallOptions, AICallResult } from '../types';

// Claude CLI는 별칭을 받음 (haiku, sonnet, opus)
// 풀네임도 가능 (claude-sonnet-4-6 등)
const MODEL_MAP: Record<string, string> = {
  haiku: 'haiku',
  sonnet: 'sonnet',
  opus: 'opus',
};

class ClaudeCliProvider implements AIProvider {
  readonly name = 'claude-cli' as const;

  async isAvailable(): Promise<boolean> {
    try {
      await this.runCli(['--version'], 5000);
      return true;
    } catch {
      return false;
    }
  }

  async call(prompt: string, options: AICallOptions = {}): Promise<AICallResult> {
    const start = Date.now();
    const model = options.model ?? 'sonnet';
    const timeoutMs = options.timeoutMs ?? 120_000;

    const args = ['--print', '-p', prompt];

    if (options.model) {
      const modelName = MODEL_MAP[options.model] ?? options.model;
      args.push('--model', modelName);
    }

    if (options.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt);
    }

    const output = await this.runCli(args, timeoutMs);

    if (!output || output.length === 0) {
      throw new Error('Claude CLI returned empty output');
    }

    return {
      output: output.trim(),
      source: 'claude-cli',
      model: MODEL_MAP[model] ?? model,
      durationMs: Date.now() - start,
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil(output.length / 4),
    };
  }

  private runCli(args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      // 핵심: stdin을 ignore하면 claude CLI가 입력 대기 안 함
      // pipe + write + end는 일부 환경에서 exit 1 발생
      const child = spawn('claude', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Claude CLI timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(
            new Error(
              `Claude CLI exited with code ${code}: ${stderr || 'no stderr'} | stdout: ${stdout.slice(0, 200)}`
            )
          );
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}

export const claudeCliProvider = new ClaudeCliProvider();
