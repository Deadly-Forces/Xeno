const baseUrl = process.env.LOAD_TEST_URL ?? "http://127.0.0.1:3000";
const requests = Number(process.env.LOAD_TEST_REQUESTS ?? 200);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 20);
const latencies = [];
let failures = 0;
for (let offset = 0; offset < requests; offset += concurrency) {
  await Promise.all(Array.from({ length: Math.min(concurrency, requests - offset) }, async () => {
    const started = performance.now();
    try { const response = await fetch(`${baseUrl}/api/health`); if (!response.ok) failures += 1; } catch { failures += 1; }
    latencies.push(performance.now() - started);
  }));
}
latencies.sort((a, b) => a - b);
const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] ?? 0;
const result = { requests, concurrency, failures, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99) };
console.log(JSON.stringify(result));
if (failures > 0 || result.p95Ms > Number(process.env.LOAD_TEST_P95_LIMIT_MS ?? 500)) process.exit(1);
