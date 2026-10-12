import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";


const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const outputPath = resolve(
  process.argv[2] || "artifacts/semantic-retrieval/browser-static-v4/browser-search-validation.json"
);
const baseUrl = process.argv[3] || "/artifacts/semantic-retrieval/browser-static-v4/payload";
const chromePath = process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const mimeTypes = {
  ".f32": "application/octet-stream",
  ".gz": "application/gzip",
  ".html": "text/html; charset=utf-8",
  ".i8": "application/octet-stream",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".u32": "application/octet-stream"
};

function delay(milliseconds) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

async function freePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
}

function staticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const target = resolve(projectRoot, relative || "index.html");
      if (target !== projectRoot && !target.startsWith(`${projectRoot}${sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const body = await readFile(target);
      response.writeHead(200, {
        "Content-Type": mimeTypes[extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
}

async function waitForTarget(debugPort) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json`);
      const targets = await response.json();
      const target = targets.find(item => item.url.includes("qwen3-browser-static-v4-search.html"));
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
  const opened = new Promise((resolveOpen, reject) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
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
    close() { socket.close(); }
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

const webPort = await freePort();
const debugPort = await freePort();
const profileDirectory = await mkdtemp(resolve(tmpdir(), "qwen3-browser-static-v4-search-"));
const server = staticServer();
await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(webPort, "127.0.0.1", resolveListen);
});
const pageUrl = `http://127.0.0.1:${webPort}/tests/manual/qwen3-browser-static-v4-search.html?base=${encodeURIComponent(baseUrl)}`;
const chrome = spawn(chromePath, [
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDirectory}`,
  "--headless=new",
  "--no-first-run",
  "--disable-extensions",
  pageUrl
], { stdio: ["ignore", "ignore", "pipe"] });

let client;
try {
  const target = await waitForTarget(debugPort);
  client = cdpClient(target.webSocketDebuggerUrl);
  await client.send("Runtime.enable");
  const deadline = Date.now() + 300_000;
  let status = "loading";
  while (Date.now() < deadline) {
    status = await evaluate(client, "document.body.dataset.status");
    if (["pass", "fail", "error"].includes(status)) break;
    await delay(500);
  }
  const raw = await evaluate(client, "document.querySelector('#result').textContent");
  const result = JSON.parse(raw);
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  if (status !== "pass") throw new Error(`Browser static search validation ${status}: ${raw}`);
  console.log(JSON.stringify({ status, output: outputPath, queries: result.queries.length }));
} finally {
  client?.close();
  chrome.kill("SIGTERM");
  server.close();
  await delay(300);
  await rm(profileDirectory, { recursive: true, force: true });
}
