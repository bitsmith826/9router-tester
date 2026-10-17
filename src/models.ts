export const ALL_MODELS_KEY = '__ALL_MODELS__';
export const CUSTOM_MODEL_KEY = '__CUSTOM_MODEL_INPUT__';

export const POPULAR_MODEL_PRESETS = [
  'claude-3-5-sonnet',
  'claude-3-5-haiku',
  'claude-3-opus',
  'gpt-4o',
  'gpt-4o-mini',
  'o3-mini',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'deepseek-chat',
  'deepseek-reasoner',
  'meta-llama/llama-3.3-70b-instruct',
  'qwen/qwen-2.5-coder-32b-instruct',
  'mistral-large-latest'
];

export function normalizeModelsUrl(inputUrl: string): string {
  let clean = inputUrl.trim();
  if (clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }
  if (clean.endsWith('/chat/completions')) {
    clean = clean.replace(/\/chat\/completions$/, '');
  }
  if (clean.endsWith('/v1')) {
    return `${clean}/models`;
  }
  if (clean.endsWith('/models')) {
    return clean;
  }
  return `${clean}/v1/models`;
}

export async function fetchRouterModels(
  baseUrl: string,
  apiKey: string,
  timeoutMs: number = 6000
): Promise<string[]> {
  const modelsUrl = normalizeModelsUrl(baseUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data: any = await response.json();
    let modelList: string[] = [];

    // OpenAI standard format: { object: "list", data: [ { id: "..." } ] }
    if (Array.isArray(data.data)) {
      modelList = data.data.map((item: any) => item.id || item.name).filter(Boolean);
    } else if (Array.isArray(data.models)) {
      // Ollama / Gemini format: { models: [ { name: "..." } ] }
      modelList = data.models.map((item: any) => item.name || item.id).filter(Boolean);
    } else if (Array.isArray(data)) {
      modelList = data.map((item: any) => (typeof item === 'string' ? item : item.id || item.name)).filter(Boolean);
    }

    return Array.from(new Set(modelList)).sort();
  } catch (_) {
    clearTimeout(timeoutId);
    return [];
  }
}
