import { BenchmarkConfig } from './types.js';

export function buildChatPayload(config: BenchmarkConfig): Record<string, any> {
  if (config.mode === 'rpm') {
    return {
      model: config.model,
      messages: [
        {
          role: 'user',
          content: 'ping'
        }
      ],
      max_tokens: 5,
      temperature: 0.1,
      stream: config.stream
    };
  }

  // TPM Mode: heavier payload to challenge Token-Per-Minute boundaries
  const tpmSampleContext = `
Analyze the following architectural summary and provide a 3-paragraph executive overview:
In distributed microservices, rate-limiting algorithms like Token Bucket, Leaky Bucket, and Fixed Window
serve distinct purposes. An API gateway acts as the reverse proxy orchestrating upstream traffic,
monitoring quotas, detecting HTTP 429 status codes, and executing failovers. Evaluate resilience,
concurrency contention, backpressure handling, socket exhaustion, and failover telemetry.
`.repeat(3);

  return {
    model: config.model,
    messages: [
      {
        role: 'system',
        content: 'You are an AI benchmark response simulator. Answer concisely.'
      },
      {
        role: 'user',
        content: tpmSampleContext
      }
    ],
    max_tokens: 350,
    temperature: 0.2,
    stream: config.stream
  };
}
