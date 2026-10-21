import { BenchmarkConfig, BenchmarkSummary, LatencyPercentiles, RequestResult } from './types.js';

export function calculatePercentiles(latencies: number[]): LatencyPercentiles {
  if (latencies.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const total = sorted.reduce((sum, val) => sum + val, 0);

  const getPercentile = (pct: number) => {
    const index = Math.ceil((pct / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  };

  return {
    min: Math.round(sorted[0]),
    max: Math.round(sorted[sorted.length - 1]),
    avg: Math.round(total / sorted.length),
    p50: Math.round(getPercentile(50)),
    p90: Math.round(getPercentile(90)),
    p95: Math.round(getPercentile(95)),
    p99: Math.round(getPercentile(99)),
  };
}

export function analyzeResults(
  config: BenchmarkConfig,
  results: RequestResult[],
  startTime: Date,
  endTime: Date
): BenchmarkSummary {
  const totalDurationMs = Math.max(1, endTime.getTime() - startTime.getTime());
  const validLatencies = results.filter(r => r.statusCode === 200).map(r => r.latencyMs);

  let successCount = 0;
  let rateLimitCount = 0;
  let clientErrorCount = 0;
  let serverErrorCount = 0;
  let timeoutCount = 0;
  let fallbackCount = 0;

  const modelDistribution: Record<string, number> = {};
  const statusDistribution: Record<string, number> = {};

  for (const r of results) {
    const isTimeout = r.statusCode === 0 ||
      r.statusCode === 504 ||
      r.statusCode === 524 ||
      Boolean(r.error && r.error.toLowerCase().includes('timeout'));

    const statusKey = r.statusCode === 0 ? 'TIMEOUT/ERR' : `${r.statusCode}`;
    statusDistribution[statusKey] = (statusDistribution[statusKey] || 0) + 1;

    if (r.statusCode === 200) {
      successCount++;
    } else if (r.statusCode === 429) {
      rateLimitCount++;
    } else if (isTimeout) {
      timeoutCount++;
    } else if (r.statusCode >= 400 && r.statusCode < 500) {
      clientErrorCount++;
    } else if (r.statusCode >= 500) {
      serverErrorCount++;
    }

    if (r.isFallback) {
      fallbackCount++;
    }

    if (r.actualModel) {
      modelDistribution[r.actualModel] = (modelDistribution[r.actualModel] || 0) + 1;
    }
  }

  const throughputRps = Number(((results.length / totalDurationMs) * 1000).toFixed(2));

  // TTFT calculation for streaming requests
  const validTtft = results
    .filter(r => r.statusCode === 200 && r.ttftMs !== undefined)
    .map(r => r.ttftMs!);

  const ttftPercentiles = validTtft.length > 0 ? calculatePercentiles(validTtft) : undefined;

  // Aggregate Rate Limit Telemetry (Retry-After, Reset timestamps)
  const sampleRateLimit = results.find(r => r.statusCode === 429 && r.rateLimitDetails)?.rateLimitDetails;

  // Aggregate Token Telemetry
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let hasTokenData = false;

  for (const r of results) {
    if (r.tokenUsage) {
      hasTokenData = true;
      totalPromptTokens += r.tokenUsage.promptTokens || 0;
      totalCompletionTokens += r.tokenUsage.completionTokens || 0;
      totalTokens += r.tokenUsage.totalTokens || ((r.tokenUsage.promptTokens || 0) + (r.tokenUsage.completionTokens || 0));
    }
  }

  const tokensPerSecond = hasTokenData && totalDurationMs > 0
    ? Math.round((totalTokens / totalDurationMs) * 1000)
    : 0;
  const estimatedTpm = tokensPerSecond * 60;

  const aggregateTokens = hasTokenData ? {
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    totalTokens,
    tokensPerSecond,
    estimatedTpm
  } : undefined;

  return {
    config,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    totalDurationMs,
    totalRequests: results.length,
    successCount,
    rateLimitCount,
    clientErrorCount,
    serverErrorCount,
    timeoutCount,
    throughputRps,
    latencies: calculatePercentiles(validLatencies.length > 0 ? validLatencies : results.map(r => r.latencyMs)),
    ttft: ttftPercentiles,
    tokenUsage: aggregateTokens,
    rateLimitInfo: sampleRateLimit,
    fallbackCount,
    modelDistribution,
    statusDistribution
  };
}
