export type AIProvider = "groq" | "openai" | "openrouter" | "gemini";

export type AIConfig = {
  provider: AIProvider;
  apiKey: string;
  model: string;
};

export const AI_PROVIDERS: Record<AIProvider, { label: string; model: string; models: string[]; endpoint: string }> = {
  groq: { label: "Groq", model: "llama-3.3-70b-versatile", models: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant", "qwen/qwen3-32b"], endpoint: "https://api.groq.com/openai/v1/chat/completions" },
  openai: { label: "OpenAI", model: "gpt-4o-mini", models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"], endpoint: "https://api.openai.com/v1/chat/completions" },
  openrouter: { label: "OpenRouter", model: "openai/gpt-4o-mini", models: ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "anthropic/claude-3.7-sonnet"], endpoint: "https://openrouter.ai/api/v1/chat/completions" },
  gemini: { label: "Gemini", model: "gemini-2.5-flash", models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"], endpoint: "https://generativelanguage.googleapis.com/v1beta/models/" },
};

const STORAGE_KEY = "medatlas-ai-config-v1";

export function readAIConfig(): AIConfig {
  const fallback: AIConfig = { provider: "groq", apiKey: "", model: AI_PROVIDERS.groq.model };
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AIConfig>;
      const provider = isProvider(parsed.provider) ? parsed.provider : fallback.provider;
      return { provider, apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "", model: typeof parsed.model === "string" && parsed.model.trim() ? parsed.model : AI_PROVIDERS[provider].model };
    }
    // One-time migration from the older browser-persistent Groq setting.
    const legacyKey = localStorage.getItem("clinical-ai-key") || "";
    const legacyModel = localStorage.getItem("clinical-ai-model") || fallback.model;
    if (legacyKey) {
      const migrated = { ...fallback, apiKey: legacyKey, model: legacyModel };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem("clinical-ai-key");
      localStorage.removeItem("clinical-ai-model");
      return migrated;
    }
  } catch {
    // Storage may be unavailable in private browsing; the in-memory UI still works.
  }
  return fallback;
}

export function saveAIConfig(config: AIConfig): void {
  const provider = isProvider(config.provider) ? config.provider : "groq";
  const clean = { provider, apiKey: config.apiKey.trim(), model: config.model.trim() || AI_PROVIDERS[provider].model };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    localStorage.removeItem("clinical-ai-key");
    localStorage.removeItem("clinical-ai-model");
  } catch {
    throw new Error("Browser session storage is unavailable. Check browser privacy settings.");
  }
}

function isProvider(value: unknown): value is AIProvider {
  return value === "groq" || value === "openai" || value === "openrouter" || value === "gemini";
}

export async function generateAIText(config: AIConfig, system: string, prompt: string, maxTokens = 1400): Promise<string> {
  if (!config.apiKey.trim()) throw new Error("Add an API key in AI Settings first.");
  if (!isProvider(config.provider)) throw new Error("Choose a supported AI provider.");
  const model = config.model.trim() || AI_PROVIDERS[config.provider].model;
  const gemini = config.provider === "gemini";
  let response: Response;
  try {
    response = await fetch(gemini
      ? AI_PROVIDERS.gemini.endpoint + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(config.apiKey.trim())
      : AI_PROVIDERS[config.provider].endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(!gemini ? { Authorization: "Bearer " + config.apiKey.trim(), ...(config.provider === "openrouter" ? { "HTTP-Referer": window.location.origin, "X-Title": "MedAtlas" } : {}) } : {}),
      },
      body: JSON.stringify(gemini
        ? { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens } }
        : { model, temperature: 0.2, max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
    });
  } catch {
    throw new Error("Could not reach the AI provider. Check your internet connection and try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.error?.message || data?.message;
    if (response.status === 401 || response.status === 403) throw new Error("API key rejected by " + AI_PROVIDERS[config.provider].label + ". Check the key and its permissions.");
    if (response.status === 404) throw new Error("Model not found or unavailable for this API key. Check the provider's current model catalogue.");
    if (response.status === 429) throw new Error("Provider rate limit or quota reached. Wait or check your account usage.");
    throw new Error(detail || AI_PROVIDERS[config.provider].label + " request failed (" + response.status + ").");
  }
  const content = gemini
    ? data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("\n")
    : data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("The AI provider returned an empty answer. Check model availability and provider response.");
  return content.trim();
}

export async function testAIConnection(config: AIConfig): Promise<void> {
  const result = await generateAIText(config, "You are a connection test. Reply with exactly: Connection successful.", "Reply with exactly: Connection successful.", 32);
  if (!/connection successful/i.test(result)) throw new Error("The provider responded, but the connection test did not return the expected confirmation.");
}
