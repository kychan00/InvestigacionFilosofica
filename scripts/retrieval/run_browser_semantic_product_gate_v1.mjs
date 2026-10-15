import { spawn, execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";


const execFileAsync = promisify(execFile);
const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const gateDirectory = resolve(projectRoot, "benchmark/semantic-retrieval/browser-product-gate-v1");
const preregistrationPath = resolve(gateDirectory, "preregistration.json");
const outputPath = resolve(process.argv[2] || resolve(gateDirectory, "result.json"));
const logPath = resolve(process.argv[3] || resolve(gateDirectory, "run.log"));
const chromePath = process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const preregistration = JSON.parse(await readFile(preregistrationPath, "utf8"));
const publicUrl = preregistration.source.public_url;


function delay(milliseconds) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}


function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}


async function freePort() {
  const { createServer } = await import("node:http");
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
}


async function waitForTarget(debugPort) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json`);
      const targets = await response.json();
      const target = targets.find(item => item.type === "page" && item.url.includes("InvestigacionFilosofica"));
      if (target?.webSocketDebuggerUrl) return target;
    } catch {
      // Chrome is starting.
    }
    await delay(250);
  }
  throw new Error("Chrome DevTools target did not become ready");
}


function cdpClient(url) {
  const socket = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  const opened = new Promise((resolveOpen, reject) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
      return;
    }
    for (const listener of listeners.get(message.method) || []) listener(message.params || {});
  });
  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      const promise = new Promise((resolveRequest, rejectRequest) => {
        pending.set(id, { resolve: resolveRequest, reject: rejectRequest });
      });
      socket.send(JSON.stringify({ id, method, params }));
      return await promise;
    },
    on(method, listener) {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(listener);
    },
    close() {
      socket.close();
    }
  };
}


async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}


async function waitForReady(client) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const ready = await evaluate(client, `document.readyState === "complete" && Boolean(document.querySelector("#search-form"))`);
    if (ready) return;
    await delay(250);
  }
  throw new Error("Public page did not become ready");
}


async function profileBytes(profileDirectory) {
  const { stdout } = await execFileAsync("du", ["-sk", profileDirectory]);
  return Number(stdout.trim().split(/\s+/)[0]) * 1024;
}


async function storageUsage(client) {
  try {
    const result = await client.send("Storage.getUsageAndQuota", {
      origin: new URL(publicUrl).origin
    });
    return {
      usage_bytes: result.usage,
      quota_bytes: result.quota,
      breakdown: result.usageBreakdown || []
    };
  } catch (error) {
    return { unavailable: error.message };
  }
}


function metricMap(payload) {
  return Object.fromEntries((payload.metrics || []).map(item => [item.name, item.value]));
}


function aggregateNetwork(records) {
  const completed = records.filter(item => item.finished);
  const byOrigin = {};
  for (const item of completed) {
    let origin = "invalid";
    try {
      origin = new URL(item.url).origin;
    } catch {
      // Retain the invalid bucket.
    }
    const bucket = byOrigin[origin] ||= {
      requests: 0,
      encoded_bytes: 0,
      cache_hits: 0,
      failures: 0
    };
    bucket.requests += 1;
    bucket.encoded_bytes += item.encoded_data_length || 0;
    if (item.from_disk_cache || item.from_service_worker || item.served_from_cache) bucket.cache_hits += 1;
    if (item.failed) bucket.failures += 1;
  }
  return {
    requests: completed.length,
    encoded_bytes: completed.reduce((total, item) => total + (item.encoded_data_length || 0), 0),
    cache_hits: completed.filter(item => item.from_disk_cache || item.from_service_worker || item.served_from_cache).length,
    failures: completed.filter(item => item.failed).length,
    by_origin: byOrigin,
    semantic_service_posts: records.filter(item =>
      item.method === "POST" && item.url.includes("/api/search/semantic")
    ).map(item => item.url)
  };
}


async function installTimeline(client) {
  await evaluate(client, `(() => {
    window.__browserProductGateTimeline = [];
    window.__browserProductGateStart = performance.now();
    window.__browserProductGateObserver?.disconnect?.();
    const target = document.querySelector("#status");
    const record = () => window.__browserProductGateTimeline.push({
      milliseconds: Math.round(performance.now() - window.__browserProductGateStart),
      text: target?.textContent?.trim() || ""
    });
    window.__browserProductGateObserver = new MutationObserver(record);
    if (target) window.__browserProductGateObserver.observe(target, { childList: true, subtree: true, characterData: true });
    record();
    return true;
  })()`);
}


async function runPhase(client, phase, networkRecords, activePhase) {
  activePhase.value = phase.phase;
  await installTimeline(client);
  const networkStart = networkRecords.length;
  const performanceStart = metricMap(await client.send("Performance.getMetrics"));
  const storageStart = await storageUsage(client);
  const startedAt = Date.now();
  const heapSamples = [];

  await evaluate(client, `(() => {
    const semantic = document.querySelector('[data-search-mode="semantic"]');
    if (semantic?.getAttribute("aria-pressed") !== "true") semantic.click();
    const input = document.querySelector("#search-input");
    input.value = ${JSON.stringify(phase.query)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#search-form").requestSubmit();
    return true;
  })()`);

  const deadline = Date.now() + 1_800_000;
  let snapshot;
  while (Date.now() < deadline) {
    snapshot = await evaluate(client, `(() => ({
      status: document.querySelector("#status")?.textContent?.trim() || "",
      cards: document.querySelectorAll(".result-card").length,
      busy: document.querySelector("#results")?.getAttribute("aria-busy"),
      heap: performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null
    }))()`);
    if (snapshot.heap) heapSamples.push(snapshot.heap.used);
    if (snapshot.status.includes("procesados en este navegador") && snapshot.cards >= phase.expected_result_keys.length) break;
    if (snapshot.status.includes("respaldo tradicional") || snapshot.status.includes("no pudo completarse")) {
      throw new Error(`${phase.phase} left browser-static-v4: ${snapshot.status}`);
    }
    await delay(500);
  }
  if (!snapshot?.status.includes("procesados en este navegador")) {
    throw new Error(`${phase.phase} timed out: ${snapshot?.status || "no status"}`);
  }
  await delay(1_000);

  const dom = await evaluate(client, `(() => ({
    status: document.querySelector("#status")?.textContent?.trim() || "",
    timeline: window.__browserProductGateTimeline || [],
    results: [...document.querySelectorAll(".result-card")].map(card => ({
      rank: Number(card.dataset.rank),
      key: card.querySelector(".record-open")?.dataset.recordId || null,
      title: card.querySelector("h2")?.textContent?.trim() || ""
    }))
  }))()`);
  const observedKeys = dom.results.slice(0, phase.expected_result_keys.length).map(item => item.key);
  const performanceEnd = metricMap(await client.send("Performance.getMetrics"));
  const storageEnd = await storageUsage(client);
  const phaseNetwork = networkRecords.slice(networkStart).filter(item => item.phase === phase.phase);
  const duration = Date.now() - startedAt;
  const exactResults = JSON.stringify(observedKeys) === JSON.stringify(phase.expected_result_keys);

  return {
    phase: phase.phase,
    query_id: phase.query_id,
    query: phase.query,
    duration_ms: duration,
    status: dom.status,
    timeline: dom.timeline,
    results: dom.results,
    expected_result_keys: phase.expected_result_keys,
    exact_result_order: exactResults,
    network: aggregateNetwork(phaseNetwork),
    storage: {
      start: storageStart,
      end: storageEnd
    },
    javascript_heap: {
      start_bytes: performanceStart.JSHeapUsedSize ?? null,
      peak_sample_bytes: heapSamples.length ? Math.max(...heapSamples) : null,
      p95_sample_bytes: percentile(heapSamples, 0.95),
      end_bytes: performanceEnd.JSHeapUsedSize ?? null,
      limit_bytes: snapshot?.heap?.limit ?? null
    }
  };
}


await stat(chromePath);
await mkdir(resolve(outputPath, ".."), { recursive: true });
const debugPort = await freePort();
const profileDirectory = await mkdtemp(resolve(tmpdir(), "browser-semantic-product-gate-v1-"));
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDirectory}`,
  "--headless=new",
  "--no-first-run",
  "--disable-extensions",
  publicUrl
], { stdio: ["ignore", "ignore", "pipe"] });

const chromeErrors = [];
chrome.stderr.on("data", chunk => {
  const text = chunk.toString().trim();
  if (text) chromeErrors.push(text);
});

let client;
const networkRecords = [];
const requests = new Map();
const activePhase = { value: "navigation" };
try {
  const target = await waitForTarget(debugPort);
  client = cdpClient(target.webSocketDebuggerUrl);
  client.on("Network.requestWillBeSent", event => {
    const record = {
      request_id: event.requestId,
      phase: activePhase.value,
      url: event.request.url,
      method: event.request.method,
      resource_type: event.type || null,
      timestamp: event.timestamp,
      from_disk_cache: false,
      from_service_worker: false,
      served_from_cache: false,
      finished: false,
      failed: false
    };
    requests.set(event.requestId, record);
    networkRecords.push(record);
  });
  client.on("Network.requestServedFromCache", event => {
    if (requests.has(event.requestId)) requests.get(event.requestId).served_from_cache = true;
  });
  client.on("Network.responseReceived", event => {
    const record = requests.get(event.requestId);
    if (!record) return;
    record.status = event.response.status;
    record.mime_type = event.response.mimeType;
    record.protocol = event.response.protocol;
    record.from_disk_cache = Boolean(event.response.fromDiskCache);
    record.from_service_worker = Boolean(event.response.fromServiceWorker);
  });
  client.on("Network.loadingFinished", event => {
    const record = requests.get(event.requestId);
    if (!record) return;
    record.finished = true;
    record.encoded_data_length = event.encodedDataLength;
  });
  client.on("Network.loadingFailed", event => {
    const record = requests.get(event.requestId);
    if (!record) return;
    record.finished = true;
    record.failed = true;
    record.error_text = event.errorText;
    record.encoded_data_length = 0;
  });

  await Promise.all([
    client.send("Runtime.enable"),
    client.send("Page.enable"),
    client.send("Network.enable", { maxTotalBufferSize: 0, maxResourceBufferSize: 0 }),
    client.send("Performance.enable")
  ]);
  await waitForReady(client);

  const browserVersion = await client.send("Browser.getVersion");
  const adapter = await evaluate(client, `(async () => {
    if (!navigator.gpu) return null;
    const value = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    const info = value?.info || {};
    return value ? {
      vendor: info.vendor || null,
      architecture: info.architecture || null,
      device: info.device || null,
      description: info.description || null,
      is_fallback_adapter: info.isFallbackAdapter ?? value.isFallbackAdapter ?? null
    } : null;
  })()`);
  const platform = await evaluate(client, `({
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    hardware_concurrency: navigator.hardwareConcurrency,
    device_memory_gib: navigator.deviceMemory || null,
    cross_origin_isolated: crossOriginIsolated
  })`);
  const publicModuleText = await fetch(
    new URL("src/core/browser-semantic-v4.js", publicUrl)
  ).then(response => {
    if (!response.ok) throw new Error(`Public browser module returned ${response.status}`);
    return response.text();
  });
  const corpusRevisionPinned = publicModuleText.includes(preregistration.source.corpus_revision);

  const phases = [];
  phases.push(await runPhase(client, preregistration.fixed_sequence[0], networkRecords, activePhase));
  phases[0].profile_bytes_after = await profileBytes(profileDirectory);
  phases.push(await runPhase(client, preregistration.fixed_sequence[1], networkRecords, activePhase));
  phases[1].profile_bytes_after = await profileBytes(profileDirectory);

  activePhase.value = "warm_reload_navigation";
  await client.send("Page.reload", { ignoreCache: false });
  await waitForReady(client);
  phases.push(await runPhase(client, preregistration.fixed_sequence[2], networkRecords, activePhase));
  phases[2].profile_bytes_after = await profileBytes(profileDirectory);

  const gates = {
    all_three_phases_complete: phases.length === 3,
    webgpu_adapter_required: Boolean(adapter),
    fallback_adapter_forbidden: adapter?.is_fallback_adapter !== true,
    browser_static_v4_completion_required: phases.every(item => item.status.includes("procesados en este navegador")),
    semantic_service_post_fallback_forbidden: phases.every(item => item.network.semantic_service_posts.length === 0),
    rendered_result_keys_match_frozen_order: phases.every(item => item.exact_result_order),
    public_browser_module_pins_corpus_revision: corpusRevisionPinned,
    warm_reload_transfer_lower_than_cold:
      phases[2].network.encoded_bytes < phases[0].network.encoded_bytes
  };
  const pass = Object.values(gates).every(Boolean);
  const result = {
    schema_version: "qwen3-browser-semantic-product-gate-result-v1",
    gate_id: preregistration.gate_id,
    measured_at: new Date().toISOString(),
    status: pass ? "pass" : "fail",
    environment: {
      browser: browserVersion,
      adapter,
      platform
    },
    source: preregistration.source,
    phases,
    gates,
    limitations: preregistration.interpretation,
    chrome_stderr_tail: chromeErrors.join("\n").split("\n").slice(-30)
  };
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  const log = [
    `${result.measured_at} ${result.gate_id} ${result.status}`,
    `browser=${browserVersion.product}`,
    `adapter=${JSON.stringify(adapter)}`,
    ...phases.map(item =>
      `${item.phase} duration_ms=${item.duration_ms} encoded_bytes=${item.network.encoded_bytes} cache_hits=${item.network.cache_hits} heap_peak=${item.javascript_heap.peak_sample_bytes} exact_results=${item.exact_result_order}`
    ),
    `gates=${JSON.stringify(gates)}`
  ].join("\n");
  await writeFile(logPath, `${log}\n`);
  console.log(JSON.stringify({ status: result.status, output: outputPath, phases: phases.map(item => ({
    phase: item.phase,
    duration_ms: item.duration_ms,
    encoded_bytes: item.network.encoded_bytes,
    exact_results: item.exact_result_order
  })) }));
  if (!pass) process.exitCode = 1;
} finally {
  client?.close();
  chrome.kill("SIGTERM");
  await delay(500);
  await rm(profileDirectory, { recursive: true, force: true });
}
