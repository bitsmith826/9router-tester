import { BenchmarkConfig, RequestResult } from './types.js';
import { buildChatPayload } from './payload.js';

export class StressTestEngine {
  private config: BenchmarkConfig;
  private endpointUrl: string;

  constructor(config: BenchmarkConfig) {
    this.config = config;
    this.endpointUrl = this.normalizeUrl(config.url);
  }

  private normalizeUrl(inputUrl: string): string {
    let clean = inputUrl.trim();
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    if (clean.endsWith('/chat/completions')) {
      return clean;
    }
    if (clean.endsWith('/v1')) {
      return `${clean}/chat/completions`;
    }
    return `${clean}/v1/chat/completions`;
  }

  private async executeSingleRequest(id: number): Promise<RequestResult> {
    const payload = buildChatPayload(this.config);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    const startTime = performance.now();
    let ttftMs: number | undefined;

    try {
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const totalLatency = Math.round(performance.now() - startTime);
      clearTimeout(timeoutId);

      const statusCode = response.status;
      const respHeaders = Object.fromEntries(response.headers.entries());

      // Check router headers across any AI gateway (9Router, LiteLLM, One API, Portkey, OpenRouter, Cloudflare, etc.)
      const fallbackHeader = respHeaders['x-9router-fallback'] ||
        respHeaders['x-litellm-fallback-model'] ||
        respHeaders['x-fallback-model'] ||
        respHeaders['x-fallback-provider'] ||
        respHeaders['x-portkey-fallback'];

      const providerHeader = respHeaders['x-9router-provider'] ||
        respHeaders['x-litellm-proxy-provider'] ||
        respHeaders['x-openrouter-provider'] ||
        respHeaders['x-portkey-provider'] ||
        respHeaders['x-oneapi-provider'] ||
        respHeaders['x-newapi-provider'] ||
        respHeaders['x-upstream-provider'];

      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch (_) {
          errorBody = `HTTP ${statusCode}`;
        }

        return {
          id,
          statusCode,
          latencyMs: totalLatency,
          requestedModel: this.config.model,
          isFallback: Boolean(fallbackHeader),
          fallbackInfo: fallbackHeader ? `Via header: ${fallbackHeader}` : undefined,
          error: errorBody.slice(0, 300)
        };
      }

      // Handle successful response
      let actualModel: string | undefined;
      let tokenUsage: any;

      if (this.config.stream && response.body) {
        // Simple stream reader to catch first chunk for TTFT
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let receivedFirstChunk = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!receivedFirstChunk) {
              ttftMs = Math.round(performance.now() - startTime);
              receivedFirstChunk = true;
            }
            const chunk = decoder.decode(value, { stream: true });
            if (!actualModel) {
              const modelMatch = chunk.match(/"model"\s*:\s*"([^"]+)"/);
              if (modelMatch) actualModel = modelMatch[1];
            }
          }
        } catch (_) {
          // Streaming completed or interrupted
        }
      } else {
        try {
          const json: any = await response.json();
          actualModel = json.model;
          if (json.usage) {
            tokenUsage = {
              promptTokens: json.usage.prompt_tokens,
              completionTokens: json.usage.completion_tokens,
              totalTokens: json.usage.total_tokens
            };
          }
        } catch (parseErr: any) {
          return {
            id,
            statusCode,
            latencyMs: totalLatency,
            requestedModel: this.config.model,
            isFallback: false,
            error: `Invalid JSON returned: ${parseErr.message}`
          };
        }
      }

      // Detect Smart Fallback
      // If 9Router rerouted request to another model/provider
      let isFallback = Boolean(fallbackHeader);
      let fallbackInfo: string | undefined;

      if (actualModel && actualModel.toLowerCase() !== this.config.model.toLowerCase()) {
        isFallback = true;
        fallbackInfo = `Model swapped: requested '${this.config.model}' -> answered by '${actualModel}'`;
      } else if (fallbackHeader) {
        fallbackInfo = `Provider fallback: ${fallbackHeader}`;
      } else if (providerHeader) {
        fallbackInfo = `Provider: ${providerHeader}`;
      }

      return {
        id,
        statusCode,
        latencyMs: totalLatency,
        ttftMs,
        requestedModel: this.config.model,
        actualModel: actualModel || this.config.model,
        isFallback,
        fallbackInfo,
        tokenUsage
      };

    } catch (err: any) {
      clearTimeout(timeoutId);
      const totalLatency = Math.round(performance.now() - startTime);
      const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');

      return {
        id,
        statusCode: 0,
        latencyMs: totalLatency,
        requestedModel: this.config.model,
        isFallback: false,
        error: isTimeout ? 'Request Timeout (exceeded limit)' : err.message || 'Network error'
      };
    }
  }

  public async run(
    onProgress?: (completed: number, total: number, latest: RequestResult) => void
  ): Promise<RequestResult[]> {
    const results: RequestResult[] = [];
    let completedCount = 0;
    const total = this.config.burstTotal;

    // Worker queue with concurrency limit
    const queue: number[] = Array.from({ length: total }, (_, i) => i + 1);
    const workers: Promise<void>[] = [];

    const worker = async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        if (id === undefined) break;

        const result = await this.executeSingleRequest(id);
        results.push(result);
        completedCount++;

        if (onProgress) {
          onProgress(completedCount, total, result);
        }
      }
    };

    const workerCount = Math.min(this.config.concurrency, total);
    for (let w = 0; w < workerCount; w++) {
      workers.push(worker());
    }

    await Promise.all(workers);
    return results.sort((a, b) => a.id - b.id);
  }
}
