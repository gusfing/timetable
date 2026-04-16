const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';
const FALLBACK_MODEL = 'google/gemini-flash-1.5';

export const AVAILABLE_MODELS = [
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)' },
  { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' },
];

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: OpenRouterOptions = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const model = options.model || DEFAULT_MODEL;

  const body: any = {
    model,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 2000,
  };

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://anti-gravity-timetable.vercel.app',
      'X-Title': 'Anti-Gravity Timetable',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    // Try fallback model if primary fails
    if (model === DEFAULT_MODEL) {
      console.warn(`Primary model failed, trying fallback: ${FALLBACK_MODEL}`);
      return callOpenRouter(messages, { ...options, model: FALLBACK_MODEL });
    }
    throw new Error(err?.error?.message || `OpenRouter error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
