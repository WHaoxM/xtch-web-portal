/**
 * Production-ish deploy serve: static dist + Vercel-like /api handlers + /s3 → MinIO.
 * Default listen 0.0.0.0:3080 (LAN/public IP reachable); set SELFHOST_HOST=127.0.0.1 for loopback-only.
 * Port 3080 keeps deploy:serve off Vite's fixed :3000. Override with SELFHOST_PORT if needed.
 * Put Caddy in front for domain HTTPS on 80/443.
 *
 * Usage (from app/ or repo root):
 *   npm run build:win11-home   # writes app/dist/win11-home/ (isolated from local)
 *   npm run deploy:serve       # serves app/dist/<target>/ ; DEPLOY_TARGET or --target (default win11-home)
 *   npm run selfhost           # alias → win11-home
 *
 * Env: env/<target>/.env (legacy app/.env.<target>.local still falls back).
 * Public origin: PUBLIC_DOMAIN > PUBLIC_IP > LAN auto-detect (see publicOrigin.ts).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localApiRoutes, rawBodyRoutes } from './localApiRoutes.ts';
import { getAdminAllowlistStatus } from '../api/lib/adminAllowlist.ts';
import { detectLanIPv4, resolvePublicOrigin } from '../api/lib/publicOrigin.ts';
import {
  requireTargetEnv,
  targetEnvExampleHint,
} from '../../scripts/env/targetEnv.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const VALID_TARGETS = new Set(['win11-home', 'cloud-vps']);

const HOST = process.env.SELFHOST_HOST?.trim() || '0.0.0.0';
// Prod default 3080 so it never collides with Vite dev on 3000 (or free-dev-port).
const PORT = Number(process.env.SELFHOST_PORT || 3080);
const MINIO_HOST = '127.0.0.1';
const MINIO_PORT = 9000;

/** Deploy static root is isolated per target: app/dist/<target>/ (never shared with local build). */
function distRootForTarget(target) {
  return path.join(appRoot, 'dist', target);
}

/** Set in main() after target is known. */
let distRoot = '';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
};

function parseTarget(argv) {
  let target = process.env.DEPLOY_TARGET?.trim() || 'win11-home';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --target (expected win11-home|cloud-vps)');
      }
      target = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length);
    }
  }
  if (target === 'selfhost') target = 'win11-home';
  if (!VALID_TARGETS.has(target)) {
    throw new Error(`Unknown deploy target "${target}". Use win11-home or cloud-vps.`);
  }
  return target;
}

function envTruthy(name) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function assertSafeForPublicDeploy(envPath) {
  const blockers = [];
  if (envTruthy('DEV_CHECKOUT_BYPASS')) {
    blockers.push('DEV_CHECKOUT_BYPASS must not be set for a public deploy target');
  }
  if (process.env.DEV_AUTH_BYPASS_EMAIL?.trim()) {
    blockers.push('DEV_AUTH_BYPASS_EMAIL must not be set for a public deploy target');
  }
  if (process.env.VITE_DEV_AUTH_BYPASS_EMAIL?.trim()) {
    blockers.push('VITE_DEV_AUTH_BYPASS_EMAIL must not be set for a public deploy target');
  }

  const allowlist = getAdminAllowlistStatus();
  if (!allowlist.hasUsableEmails) {
    if (!allowlist.configured || allowlist.onlyPlaceholders) {
      blockers.push(
        'Admin allowlist must include at least one real email (not empty, not you@example.com). Set ADMIN_TECH_EMAIL_ALLOWLIST and/or ADMIN_OPS_EMAIL_ALLOWLIST (legacy ADMIN_EMAIL_ALLOWLIST still accepted as tech-only).',
      );
    }
  }

  if (blockers.length > 0) {
    console.error('Refusing to start public deploy target (safety):');
    for (const line of blockers) console.error(`  - ${line}`);
    console.error(`Fix these in ${envPath} and restart.`);
    process.exit(1);
  }
}

/** Catch wrong-target or local-bypass dist before serving. */
function assertDistSafeForPublicDeploy(distRoot, target) {
  const markerPath = path.join(distRoot, '.xtch-build-target');
  if (!fs.existsSync(markerPath)) {
    console.error('Refusing to start public deploy target (safety):');
    console.error(`  - Missing ${path.relative(appRoot, markerPath)} (build marker).`);
    console.error(`  - Local \`npm run build\` writes to dist/local/ and cannot feed deploy:serve.`);
    console.error(`Rebuild with: npm run build:${target}, then restart.`);
    process.exit(1);
  }
  const marked = fs.readFileSync(markerPath, 'utf8').trim();
  if (marked !== target) {
    console.error('Refusing to start public deploy target (safety):');
    console.error(`  - dist marker is "${marked}" but serve target is "${target}".`);
    console.error(`Rebuild with: npm run build:${target}, then restart.`);
    process.exit(1);
  }

  const assetsDir = path.join(distRoot, 'assets');
  if (!fs.existsSync(assetsDir)) return;
  const jsFiles = fs.readdirSync(assetsDir).filter((name) => name.endsWith('.js'));
  for (const name of jsFiles) {
    const text = fs.readFileSync(path.join(assetsDir, name), 'utf8');
    if (text.includes('dev-bypass-token')) {
      console.error('Refusing to start public deploy target (safety):');
      console.error(
        `  - ${path.relative(appRoot, distRoot)} was built with VITE_DEV_AUTH_BYPASS_EMAIL (contains dev-bypass-token).`,
      );
      console.error(`Rebuild with: npm run build:${target} (production env must not set bypass), then restart.`);
      process.exit(1);
    }
  }
}

async function readBody(req, raw) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const buf = Buffer.concat(chunks);
  if (raw) return buf;
  const text = buf.toString('utf8').trim();
  if (!text) return undefined;
  return JSON.parse(text);
}

function createVercelResponse(res) {
  const response = {
    status(code) {
      res.statusCode = code;
      return response;
    },
    json(payload) {
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload));
    },
    send(payload) {
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(payload);
    },
  };
  return response;
}

const handlerCache = new Map();

async function getHandler(modulePath) {
  let handler = handlerCache.get(modulePath);
  if (handler) return handler;
  const abs = path.join(appRoot, modulePath.replace(/^\//, ''));
  const mod = await import(pathToFileURL(abs).href);
  handler = mod.default;
  if (typeof handler !== 'function') {
    throw new Error(`No default handler export in ${modulePath}`);
  }
  handlerCache.set(modulePath, handler);
  return handler;
}

async function handleApi(req, res, apiPath) {
  const modulePath = localApiRoutes[apiPath];
  try {
    const useRawBody = rawBodyRoutes.has(apiPath);
    const body = await readBody(req, useRawBody);
    const handler = await getHandler(modulePath);
    await handler(
      {
        method: req.method,
        headers: req.headers,
        url: req.url,
        body,
      },
      createVercelResponse(res),
    );
  } catch (error) {
    console.error('Deploy API request failed:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Deploy API request failed.' }));
    }
  }
}

function proxyToMinio(req, res, pathnameWithQuery) {
  const targetPath = pathnameWithQuery.replace(/^\/s3(?=\/|\?|$)/, '') || '/';
  const headers = { ...req.headers, host: `${MINIO_HOST}:${MINIO_PORT}` };
  delete headers['connection'];

  const proxyReq = http.request(
    {
      hostname: MINIO_HOST,
      port: MINIO_PORT,
      path: targetPath.startsWith('/') ? targetPath : `/${targetPath}`,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (error) => {
    console.error('MinIO proxy failed:', error);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Object storage proxy failed.' }));
    } else {
      res.destroy();
    }
  });

  req.pipe(proxyReq);
}

function safeJoinDist(urlPathname) {
  const decoded = decodeURIComponent(urlPathname.split('?')[0] || '/');
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\//, '');
  const abs = path.normalize(path.join(distRoot, relative));
  if (!abs.startsWith(distRoot)) return null;
  return abs;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('content-type', type);
  fs.createReadStream(filePath).pipe(res);
}

function resolveDistFile(urlPathname) {
  const candidate = safeJoinDist(urlPathname);
  if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  // Prerendered routes: /destinations/beijing → destinations/beijing/index.html
  const dirIndexPath =
    urlPathname.endsWith('/') ? `${urlPathname}index.html` : `${urlPathname}/index.html`;
  const dirIndex = safeJoinDist(dirIndexPath);
  if (dirIndex && fs.existsSync(dirIndex) && fs.statSync(dirIndex).isFile()) {
    return dirIndex;
  }

  return null;
}

function serveStatic(req, res, urlPathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  const filePath = resolveDistFile(urlPathname);
  if (filePath) {
    if (req.method === 'HEAD') {
      res.statusCode = 200;
      res.setHeader('content-type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
      res.end();
      return;
    }
    sendFile(res, filePath);
    return;
  }

  // BrowserRouter SPA fallback
  const indexHtml = path.join(distRoot, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    res.statusCode = 503;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Missing deploy static files. Run npm run build:<target> before npm run deploy:serve.');
    return;
  }
  if (req.method === 'HEAD') {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end();
    return;
  }
  sendFile(res, indexHtml);
}

function main() {
  process.env.NODE_ENV = 'production';

  let target;
  try {
    target = parseTarget(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  let loaded;
  try {
    loaded = requireTargetEnv(target, { override: true });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(targetEnvExampleHint(target));
    process.exit(1);
  }
  const envPath = loaded.path;
  assertSafeForPublicDeploy(envPath);

  distRoot = distRootForTarget(target);
  const legacyFlatDist = path.join(appRoot, 'dist', 'index.html');
  if (!fs.existsSync(path.join(distRoot, 'index.html'))) {
    console.error(`Missing ${path.relative(appRoot, distRoot)}/index.html. Run: npm run build:${target}`);
    if (fs.existsSync(legacyFlatDist)) {
      console.error(
        'Note: found legacy app/dist/index.html — ignored. Builds are isolated under app/dist/<target>/.',
      );
    }
    process.exit(1);
  }
  assertDistSafeForPublicDeploy(distRoot, target);

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    const pathname = url.split('?')[0] || '/';

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      if (localApiRoutes[pathname]) {
        await handleApi(req, res, pathname);
        return;
      }
      res.statusCode = 404;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Not found.' }));
      return;
    }

    if (pathname === '/s3' || pathname.startsWith('/s3/')) {
      proxyToMinio(req, res, url);
      return;
    }

    serveStatic(req, res, pathname);
  });

  server.listen(PORT, HOST, () => {
    const canonicalOrigin = resolvePublicOrigin(process.env);
    const lanIp = detectLanIPv4();
    console.log(`Deploy target: ${target}`);
    console.log(`Listening on http://${HOST}:${PORT}`);
    if (canonicalOrigin) {
      console.log(`  public origin (domain > PUBLIC_IP > LAN): ${canonicalOrigin}`);
    }
    if (lanIp) {
      console.log(`  LAN hint: http://${lanIp}:${PORT}`);
    }
    console.log(`  static: ${distRoot}`);
    console.log(`  api: ${Object.keys(localApiRoutes).length} routes`);
    console.log(`  s3 proxy → http://${MINIO_HOST}:${MINIO_PORT}`);
    console.log(`  env: ${envPath}`);
    console.log(
      'Domain HTTPS: put Caddy on 80/443. Direct IP/LAN: open the LAN hint URL (firewall permitting).',
    );
  });
}

main();
