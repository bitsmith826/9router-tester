export type BenchmarkMode = 'rpm' | 'tpm';

export interface BenchmarkConfig {
  url: string;
  apiKey: string;
  model: string;
  burstTotal: number;
  concurrency: number;
  mode: BenchmarkMode;
  timeoutMs: number;
  exportPath?: string;
  stream: boolean;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface RateLimitDetails {
  retryAfter?: string;
  reset?: string;
  remaining?: string;
  message?: string;
}

export interface RequestResult {
  id: number;
  statusCode: number;
  latencyMs: number;
  ttftMs?: number;
  requestedModel: string;
  actualModel?: string;
  isFallback: boolean;
  fallbackInfo?: string;
  error?: string;
  rateLimitDetails?: RateLimitDetails;
  tokenUsage?: TokenUsage;
}

export interface LatencyPercentiles {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface BenchmarkSummary {
  config: BenchmarkConfig;
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  totalRequests: number;
  successCount: number;
  rateLimitCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  timeoutCount: number;
  throughputRps: number;
  latencies: LatencyPercentiles;
  ttft?: LatencyPercentiles;
  rateLimitInfo?: RateLimitDetails;
  fallbackCount: number;
  modelDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
}
