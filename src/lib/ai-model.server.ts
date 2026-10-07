import { createOpenAI } from "@ai-sdk/openai";

export const AI_MODEL = process.env["APP_OPENAI_MODEL"] || "gpt-4.1-mini";

export function createAiModel(apiKey: string) {
  return createOpenAI({ apiKey }).chat(AI_MODEL);
}
