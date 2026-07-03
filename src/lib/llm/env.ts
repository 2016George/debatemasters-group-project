import "server-only";
import type { LlmProviderName } from "@/lib/llm/types";

export type LlmConfig = {
  provider: LlmProviderName;
  deepseekApiKey: string;
  deepseekBaseUrl: string;
  opponentModel: string;
  judgeModel: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

export function getLlmConfig(): LlmConfig {
  const provider = (process.env.LLM_PROVIDER?.trim() ||
    "deepseek") as LlmProviderName;
  if (provider !== "deepseek") {
    throw new Error(`Unsupported LLM_PROVIDER: ${provider}`);
  }
  return {
    provider,
    deepseekApiKey: required("DEEPSEEK_API_KEY"),
    deepseekBaseUrl: optional("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
    opponentModel: optional("DEEPSEEK_MODEL_OPPONENT", "deepseek-v4-flash"),
    judgeModel: optional("DEEPSEEK_MODEL_JUDGE", "deepseek-v4-flash"),
  };
}
