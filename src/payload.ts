import { BenchmarkConfig } from './types.js';

export function buildChatPayload(config: BenchmarkConfig): Record<string, any> {
  // Reasoning models (o1, o3, deepseek-reasoner/r1) error out if temperature is passed
  const isReasoningModel = /^(o1|o3|deepseek-r)/i.test(config.model);

  if (config.mode === 'rpm') {
    const payload: Record<string, any> = {
      model: config.model,
      messages: [
        {
          role: 'user',
          content: 'Say pong'
        }
      ],
      max_tokens: config.maxTokens || 5,
      stream: config.stream
    };

    if (!isReasoningModel) {
      payload.temperature = 0.1;
    }
    return payload;
  }

  // TPM Mode: heavy token payload to push Token-Per-Minute and context limits
  const targetMaxTokens = config.maxTokens || 1000;

  const tpmPrompt = `
Analyze the following distributed systems architecture in exhaustive technical depth:
Context: In high-throughput microservices architectures, rate-limiting mechanisms (Token Bucket, Leaky Bucket, Sliding Window Counters, Redis-backed rate limiting) protect upstream LLM providers from quota exhaustion and cascading 429 failures. Reverse proxies and AI Gateways orchestrate traffic distribution, dynamic failover, backpressure mitigation, retry-after tracking, and connection pooling.

Instructions:
1. Provide a comprehensive, full architectural specification for an ultra-resilient AI API gateway.
2. Detail edge-case failure modes: socket exhaustion, DNS thrashing, buffer pool starvation, and upstream timeout spikes.
3. Include extensive, un-truncated TypeScript & Go code implementations illustrating resilient HTTP client pooling and token-bucket algorithms.
4. Elaborate on every component with full technical depth and mathematical proofs where relevant. Do not abbreviate or summarize. Generate as comprehensive and detailed a response as possible.
`.trim();

  const payload: Record<string, any> = {
    model: config.model,
    messages: [
      {
        role: 'user',
        content: tpmPrompt
      }
    ],
    max_tokens: targetMaxTokens,
    stream: config.stream
  };

  if (!isReasoningModel) {
    payload.temperature = 0.2;
  }
  return payload;
}

