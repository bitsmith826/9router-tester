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
      max_tokens: 5,
      stream: config.stream
    };

    if (!isReasoningModel) {
      payload.temperature = 0.1;
    }
    return payload;
  }

  // TPM Mode: heavier payload to challenge Token-Per-Minute boundaries
  const tpmSampleContext = `
Analyze the following architectural summary and provide a 3-paragraph executive overview:
In distributed microservices, rate-limiting algorithms like Token Bucket, Leaky Bucket, and Fixed Window
serve distinct purposes. An API gateway acts as the reverse proxy orchestrating upstream traffic,
monitoring quotas, detecting HTTP 429 status codes, and executing failovers. Evaluate resilience,
concurrency contention, backpressure handling, socket exhaustion, and failover telemetry.
`.repeat(3);

  const payload: Record<string, any> = {
    model: config.model,
    messages: [
      {
        role: 'user',
        content: tpmSampleContext
      }
    ],
    max_tokens: 350,
    stream: config.stream
  };

  if (!isReasoningModel) {
    payload.temperature = 0.2;
  }
  return payload;
}
