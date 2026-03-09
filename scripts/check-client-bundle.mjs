import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT_DIR = process.cwd();
const BUILD_MANIFEST_PATH = path.join(ROOT_DIR, ".next/build-manifest.json");
const PAGE_MANIFEST_PATH = path.join(
  ROOT_DIR,
  ".next/server/app/page_client-reference-manifest.js"
);

const INITIAL_JS_BUDGET = 550000;
const PAGE_CHUNK_BUDGET = 150000;
const ROUTE_ENTRY_CANDIDATES = [
  "[project]/src/components/app/game-shell-client.tsx",
  "[project]/src/app/page.tsx",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadPageManifest(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const sandbox = { globalThis: { __RSC_MANIFEST: {} } };
  vm.runInNewContext(source, sandbox);
  return sandbox.globalThis.__RSC_MANIFEST["/page"];
}

function normalizeChunk(chunkPath) {
  return chunkPath.startsWith("/_next/") ? chunkPath.slice("/_next/".length) : chunkPath;
}

function collectRouteChunks(clientModules) {
  for (const candidate of ROUTE_ENTRY_CANDIDATES) {
    const chunks = new Set();

    for (const [moduleName, moduleDef] of Object.entries(clientModules)) {
      if (!moduleName.startsWith(candidate)) continue;
      for (const chunk of moduleDef.chunks ?? []) {
        chunks.add(normalizeChunk(chunk));
      }
    }

    if (chunks.size > 0) {
      return [...chunks];
    }
  }

  throw new Error("Could not locate a first-party route entry chunk in the page client manifest.");
}

function getFileSize(relativePath) {
  return fs.statSync(path.join(ROOT_DIR, ".next", relativePath)).size;
}

if (!fs.existsSync(BUILD_MANIFEST_PATH) || !fs.existsSync(PAGE_MANIFEST_PATH)) {
  throw new Error("Missing Next.js build artifacts. Run `next build` before `bun run perf:bundle`.");
}

const buildManifest = readJson(BUILD_MANIFEST_PATH);
const pageManifest = loadPageManifest(PAGE_MANIFEST_PATH);
const routeChunks = collectRouteChunks(pageManifest.clientModules ?? {});
const initialChunks = [...new Set([...(buildManifest.rootMainFiles ?? []), ...routeChunks])];

const initialSize = initialChunks.reduce((sum, chunk) => sum + getFileSize(chunk), 0);
const pageChunkSize = routeChunks.reduce((sum, chunk) => sum + getFileSize(chunk), 0);

console.log(`Initial route JS: ${initialSize} bytes`);
for (const chunk of initialChunks) {
  console.log(`  ${chunk}: ${getFileSize(chunk)} bytes`);
}
console.log(`Page-specific JS: ${pageChunkSize} bytes`);
for (const chunk of routeChunks) {
  console.log(`  ${chunk}: ${getFileSize(chunk)} bytes`);
}

if (initialSize > INITIAL_JS_BUDGET) {
  throw new Error(
    `Initial route JS exceeds budget: ${initialSize} > ${INITIAL_JS_BUDGET} bytes.`
  );
}

if (pageChunkSize > PAGE_CHUNK_BUDGET) {
  throw new Error(
    `Page-specific JS exceeds budget: ${pageChunkSize} > ${PAGE_CHUNK_BUDGET} bytes.`
  );
}

console.log("Bundle budget passed.");
