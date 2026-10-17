import http from 'http';
import { StressTestEngine } from './engine.js';
import { analyzeResults } from './analyzer.js';
import { BenchmarkReporter } from './reporter.js';
import { BenchmarkConfig } from './types.js';

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
        // Simulated 429 Rate Limit
        res.writeHead(429);
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
    console.log(`✓ Smart Fallback Detected: ${summary.fallbackCount} (Pass: ${hasFallback})`);

    if (has200 && has429 && hasFallback && hasModels) {
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
