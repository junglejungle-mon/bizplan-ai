import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export type ClaudeModel = "claude-3-5-haiku-20241022" | "claude-sonnet-4-20250514" | "claude-opus-4-20250514";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export async function callClaude({
  model = "claude-sonnet-4-20250514",
  system,
  messages,
  maxTokens = 4096,
  temperature = 0.7,
}: {
  model?: ClaudeModel;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system && { system }),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.text ?? "";
}

export async function* streamClaude({
  model = "claude-sonnet-4-20250514",
  system,
  messages,
  maxTokens = 4096,
  temperature = 0.7,
}: {
  model?: ClaudeModel;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}): AsyncGenerator<string> {
  const stream = anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    ...(system && { system }),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

export { anthropic };
