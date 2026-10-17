import http from 'http';
import { StressTestEngine } from './engine.js';
import { analyzeResults } from './analyzer.js';
import { BenchmarkReporter } from './reporter.js';
import { BenchmarkConfig } from './types.js';
import { classifyModel, buildRecommendedCombos } from './classifier.js';

// Starts a mock 9Router server that returns:
// - 200 OK for first 3 requests
// - 429 Rate Limit for next 2 requests
// - Fallback to another model for subsequent requests
let requestCounter = 0;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url && req.url.includes('/models')) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({
      object: 'list',
      data: [
        { id: 'claude-3-5-sonnet', object: 'model' },
        { id: 'deepseek-chat', object: 'model' },
        { id: 'gpt-4o', object: 'model' }
      ]
    }));
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      requestCounter++;
      res.setHeader('Content-Type', 'application/json');

      if (requestCounter <= 3) {
        // Standard Success
        res.writeHead(200);
        res.end(JSON.stringify({
          id: `chatcmpl-${requestCounter}`,
          object: 'chat.completion',
          model: 'claude-3-5-sonnet',
          choices: [{ message: { role: 'assistant', content: 'pong' } }],
          usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
        }));
      } else if (requestCounter <= 5) {
        // Simulated 429 Rate Limit with Telemetry
        res.writeHead(429, {
          'Retry-After': '12',
          'x-ratelimit-reset-requests': '20s',
          'x-ratelimit-remaining-requests': '0'
        });
        res.end(JSON.stringify({
          error: {
            message: 'Rate limit exceeded: quota depleted or RPM exceeded',
            type: 'rate_limit_error',
            code: 429
          }
        }));
      } else {
        // Simulated Smart Fallback
        res.writeHead(200, {
          'x-9router-fallback': 'deepseek-chat',
          'x-9router-provider': 'deepseek'
        });
        res.end(JSON.stringify({
          id: `chatcmpl-fallback-${requestCounter}`,
          object: 'chat.completion',
          model: 'deepseek-chat', // Model swapped!
          choices: [{ message: { role: 'assistant', content: 'fallback pong' } }],
          usage: { prompt_tokens: 1, completion_tokens: 3, total_tokens: 4 }
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = 39128;

server.listen(PORT, async () => {
  console.log(`[Mock Server] Running on http://127.0.0.1:${PORT}`);

  const testConfig: BenchmarkConfig = {
    url: `http://127.0.0.1:${PORT}/v1`,
    apiKey: 'test-key',
    model: 'claude-3-5-sonnet',
    burstTotal: 8,
    concurrency: 2,
    mode: 'rpm',
    timeoutMs: 5000,
    stream: false,
    exportPath: 'reports/mock-test-report.json'
  };

  try {
    const engine = new StressTestEngine(testConfig);
    const startTime = new Date();
    const results = await engine.run();
    const endTime = new Date();

    const summary = analyzeResults(testConfig, results, startTime, endTime);
    BenchmarkReporter.printSummary(summary, results);

    // Test Model Discovery
    const { fetchRouterModels } = await import('./models.js');
    const fetchedModels = await fetchRouterModels(`http://127.0.0.1:${PORT}/v1`, 'test-key');
    const hasModels = fetchedModels.includes('claude-3-5-sonnet') && fetchedModels.includes('deepseek-chat');

    // Verification Assertions
    console.log('\n=== ASSERTION CHECKS ===');
    const has200 = summary.successCount >= 3;
    const has429 = summary.rateLimitCount === 2;
    const hasFallback = summary.fallbackCount >= 2;

    console.log(`✓ Model Discovery (/v1/models): ${fetchedModels.join(', ')} (Pass: ${hasModels})`);
    console.log(`✓ 200 OK Tracked: ${summary.successCount} (Pass: ${has200})`);
    console.log(`✓ 429 Rate Limit Detected: ${summary.rateLimitCount} (Pass: ${has429})`);
    const hasTelemetry = summary.rateLimitInfo?.retryAfter === '12s';
    console.log(`✓ 429 Telemetry (Retry-After): ${summary.rateLimitInfo?.retryAfter} (Pass: ${hasTelemetry})`);
    console.log(`✓ Smart Fallback Detected: ${summary.fallbackCount} (Pass: ${hasFallback})`);
    const hasTokenTelemetry = Boolean(summary.tokenUsage && summary.tokenUsage.totalTokens > 0);
    console.log(`✓ Token Telemetry (Total: ${summary.tokenUsage?.totalTokens}, Speed: ${summary.tokenUsage?.tokensPerSecond} tok/s): (Pass: ${hasTokenTelemetry})`);

    // Verify Classifier
    const isCoding = classifyModel('claude-3-5-sonnet').category === 'coding';
    const isReasoning = classifyModel('deepseek-reasoner').category === 'reasoning';
    const isSpeed = classifyModel('gemini-2.0-flash').category === 'speed';
    const isBudget = classifyModel('meta-llama/llama-3.3-70b-instruct').category === 'budget';
    const hasClassifier = isCoding && isReasoning && isSpeed && isBudget;
    console.log(`✓ Smart Model Classifier (Coding/Reasoning/Speed/Budget): (Pass: ${hasClassifier})`);

    // Test Multi-Model Report & Combo Generation
    const mockMultiReport = {
      timestamp: new Date().toISOString(),
      routerUrl: `http://127.0.0.1:${PORT}/v1`,
      scanMode: 'quick-scan' as const,
      totalModelsTested: 6,
      healthyModelsCount: 4,
      rateLimitedCount: 1,
      failedModelsCount: 1,
      activeModelsList: ['claude-3-5-sonnet', 'deepseek-chat', 'gemini-2.0-flash', 'deepseek-reasoner'],
      deadModelsList: [{ model: 'mistral-large', error: 'HTTP 401: Invalid Key / Dead' }],
      models: [
        {
          model: 'claude-3-5-sonnet',
          totalRequests: 1,
          successCount: 1,
          rateLimitCount: 0,
          errorCount: 0,
          avgLatencyMs: 32,
          status: 'HEALTHY' as const,
          note: 'All OK'
        },
        {
          model: 'deepseek-chat',
          totalRequests: 1,
          successCount: 1,
          rateLimitCount: 0,
          errorCount: 0,
          avgLatencyMs: 25,
          status: 'FALLBACK' as const,
          note: 'Fallback triggered'
        },
        {
          model: 'gemini-2.0-flash',
          totalRequests: 1,
          successCount: 1,
          rateLimitCount: 0,
          errorCount: 0,
          avgLatencyMs: 14,
          status: 'HEALTHY' as const,
          note: 'All OK'
        },
        {
          model: 'deepseek-reasoner',
          totalRequests: 1,
          successCount: 1,
          rateLimitCount: 0,
          errorCount: 0,
          avgLatencyMs: 45,
          status: 'HEALTHY' as const,
          note: 'All OK'
        },
        {
          model: 'gpt-4o',
          totalRequests: 1,
          successCount: 0,
          rateLimitCount: 1,
          errorCount: 0,
          avgLatencyMs: 40,
          status: 'RATE_LIMITED' as const,
          note: 'Rate limit 429'
        },
        {
          model: 'mistral-large',
          totalRequests: 1,
          successCount: 0,
          rateLimitCount: 0,
          errorCount: 1,
          avgLatencyMs: 0,
          status: 'FAILED' as const,
          note: 'HTTP 401: Invalid Key / Dead'
        }
      ]
    };
    BenchmarkReporter.printMultiModelSummary(mockMultiReport, 'reports/mock-multimodel-report.json');

    const recommendedCombos = buildRecommendedCombos([
      { model: 'claude-3-5-sonnet', avgLatencyMs: 32 },
      { model: 'deepseek-chat', avgLatencyMs: 25 },
      { model: 'gemini-2.0-flash', avgLatencyMs: 14 },
      { model: 'deepseek-reasoner', avgLatencyMs: 45 }
    ]);

    const hasCombos = recommendedCombos.length === 4 &&
      recommendedCombos.some(c => c.id === 'coding-pro') &&
      recommendedCombos.some(c => c.id === 'speed-autocomplete') &&
      recommendedCombos.some(c => c.id === 'deep-reasoning') &&
      recommendedCombos.some(c => c.id === 'budget-saver');
    console.log(`✓ 9Router Recommended Combos (4 Archetypes Generated): (Pass: ${hasCombos})`);

    if (has200 && has429 && hasFallback && hasModels && hasTelemetry && hasClassifier && hasCombos && hasTokenTelemetry) {
      console.log('\n🎉 ALL MOCK VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
    } else {
      console.error('\n❌ SOME VERIFICATION CHECKS FAILED!\n');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Test error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
});
