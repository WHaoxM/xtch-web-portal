/**
 * Production-ish deploy serve: static dist + Vercel-like /api handlers + /s3 -> MinIO.
 * Default listen 0.0.0.0:3080 (LAN/public IP reachable); set SELFHOST_HOST=127.0.0.1 for loopback-only.
 * Port 3080 keeps deploy:serve off Vite's fixed :3000. Override with SELFHOST_PORT if needed.
 * Put Caddy in front for domain HTTPS on 80/443.
 *
 * Usage (from app/ or repo root):
 *   npm run build:win11-home   # writes app/dist/win11-home/ (isolated from local)
 *   npm run deploy:serve       # serves app/dist/<target>/ ; DEPLOY_TARGET or --target (default win11-home)
 *   npm run selfhost           # alias -> win11-home
 *
 * Env: env/<target>/.env (legacy app/.env.<target>.local still falls back).
 * Public origin: PUBLIC_DOMAIN > PUBLIC_IP > LAN auto-detect (see publicOrigin.ts).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localApiRoutes, rawBodyRoutes, resolveLocalApiRoute } from './localApiRoutes.ts';
import {
  authenticateVisitorSession,
  createMessagingSocketServer,
  createRemoteMessagingAuthenticator,
  parseMessagingSocketOrigins,
} from './messagingSocket.ts';
import { startMessagingOutbox } from './messagingOutbox.ts';
import { startMessagingRetention } from './messagingRetention.ts';
import { handleMessagingCors, parseMessagingRestOrigins } from './messagingCors.ts';
import { detectLanIPv4, resolvePublicOrigin } from '../api/platform/publicOrigin.ts';
import {
  requireTargetEnv,
  targetEnvExampleHint,
} from '../../scripts/env/targetEnv.ts';
import { assertTargetEnvValid } from '../../scripts/env/validateTargetEnv.ts';
import {
  bodyLimitBytesForKind,
  ClientAbortedError,
  InvalidJsonBodyError,
  PayloadTooLargeError,
  readLimitedRequestBody,
} from './requestBodyLimits.ts';
import {
  classifyPagePath,
  createPublicPathSet,
  loadPublicRouteManifest,
  looksLikeStaticAssetPath,
} from './httpRoutePolicy.ts';

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
/** SEO public indexable paths (role 4 manifest). */
let publicPaths = new Set();
let messagingRestCorsOrigins = [];

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
  '.apk': 'application/vnd.android.package-archive',
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
    setHeader(name, value) {
      res.setHeader(name, value);
      return response;
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

function sendJsonError(res, statusCode, error) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: false, error }));
}

async function handleApi(req, res, apiPath) {
  // APIs carry session state and live content; never let a browser/WebView reuse a stale response.
  res.setHeader('cache-control', 'no-store, max-age=0');
  const modulePath = resolveLocalApiRoute(apiPath);
  const useRawBody = rawBodyRoutes.has(apiPath);
  const limitBytes = bodyLimitBytesForKind(useRawBody ? 'webhook' : 'json');

  let body;
  try {
    body = await readLimitedRequestBody(req, { raw: useRawBody, limitBytes });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      sendJsonError(res, 413, 'Payload Too Large');
      return;
    }
    if (error instanceof InvalidJsonBodyError) {
      sendJsonError(res, 400, 'Invalid JSON body.');
      return;
    }
    if (error instanceof ClientAbortedError) {
      if (!res.headersSent) res.destroy();
      return;
    }
    console.error('Deploy API body read failed:', error instanceof Error ? error.name : error);
    sendJsonError(res, 400, 'Invalid request body.');
    return;
  }

  try {
    const handler = await getHandler(modulePath);
    await handler(
      {
        method: req.method,
        headers: req.headers,
        url: req.url,
        body,
        socket: { remoteAddress: req.socket?.remoteAddress },
      },
      createVercelResponse(res),
    );
  } catch (error) {
    console.error('Deploy API request failed:', error instanceof Error ? error.message : error);
    if (!res.headersSent) {
      sendJsonError(res, 500, 'Deploy API request failed.');
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
    console.error('MinIO proxy failed:', error instanceof Error ? error.message : error);
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

function cacheControlForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'no-cache, max-age=0, must-revalidate';
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/assets/') && /-[A-Za-z0-9_-]{8,}\.[^/]+$/.test(normalized)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'no-cache, max-age=0, must-revalidate';
}

function sendFile(res, filePath, statusCode = 200) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.statusCode = statusCode;
  res.setHeader('content-type', type);
  res.setHeader('cache-control', cacheControlForFile(filePath));
  fs.createReadStream(filePath).pipe(res);
}

function resolveDistFile(urlPathname) {
  const candidate = safeJoinDist(urlPathname);
  if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  // Prerendered routes: /destinations/beijing -> destinations/beijing/index.html
  const dirIndexPath =
    urlPathname.endsWith('/') ? `${urlPathname}index.html` : `${urlPathname}/index.html`;
  const dirIndex = safeJoinDist(dirIndexPath);
  if (dirIndex && fs.existsSync(dirIndex) && fs.statSync(dirIndex).isFile()) {
    return dirIndex;
  }

  return null;
}

function sendSpaShell(res, method, statusCode) {
  const indexHtml = path.join(distRoot, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    res.statusCode = 503;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Missing deploy static files. Run npm run build:<target> before npm run deploy:serve.');
    return;
  }
  if (method === 'HEAD') {
    res.statusCode = statusCode;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end();
    return;
  }
  sendFile(res, indexHtml, statusCode);
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
      res.setHeader('cache-control', cacheControlForFile(filePath));
      res.end();
      return;
    }
    sendFile(res, filePath, 200);
    return;
  }

  if (looksLikeStaticAssetPath(urlPathname)) {
    res.statusCode = 404;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Not found');
    return;
  }

  const kind = classifyPagePath(urlPathname, publicPaths);
  if (kind === 'public' || kind === 'spa') {
    sendSpaShell(res, req.method, 200);
    return;
  }

  // Determinable unknown page: HTTP 404 + SPA HTML (client NotFound), not homepage 200.
  sendSpaShell(res, req.method, 404);
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
  messagingRestCorsOrigins = parseMessagingRestOrigins(
    process.env.IM_REST_ALLOWED_ORIGINS || process.env.MESSAGING_SOCKET_ALLOWED_ORIGINS,
  );

  try {
    assertTargetEnvValid(target, process.env, envPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  try {
    const manifest = loadPublicRouteManifest();
    publicPaths = createPublicPathSet(manifest);
  } catch (error) {
    console.error('Failed to load SEO public route manifest:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  distRoot = distRootForTarget(target);
  const legacyFlatDist = path.join(appRoot, 'dist', 'index.html');
  if (!fs.existsSync(path.join(distRoot, 'index.html'))) {
    console.error(`Missing ${path.relative(appRoot, distRoot)}/index.html. Run: npm run build:${target}`);
    if (fs.existsSync(legacyFlatDist)) {
      console.error(
        'Note: found legacy app/dist/index.html (ignored). Builds are isolated under app/dist/<target>/.',
      );
    }
    process.exit(1);
  }
  assertDistSafeForPublicDeploy(distRoot, target);

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    const pathname = url.split('?')[0] || '/';

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      if (handleMessagingCors(pathname, req, res, messagingRestCorsOrigins)) return;
      if (resolveLocalApiRoute(pathname)) {
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

  let messagingSocketEnabled = false;
  if (process.env.MESSAGING_SOCKET_ENABLED === 'true') {
    const authUrl = process.env.MESSAGING_SOCKET_AUTH_URL?.trim()
      || `http://127.0.0.1:${PORT}/api/im/auth/introspect`;
    const allowedOrigins = parseMessagingSocketOrigins(process.env.MESSAGING_SOCKET_ALLOWED_ORIGINS);
    const messagingSocket = createMessagingSocketServer(server, {
      authenticate: createRemoteMessagingAuthenticator(authUrl),
      authenticateVisitor: authenticateVisitorSession,
      allowedOrigins,
    });
    startMessagingOutbox(messagingSocket.namespace);
    startMessagingRetention();
    messagingSocketEnabled = true;
  }

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
    console.log(`  messaging socket: ${messagingSocketEnabled ? 'enabled (/im)' : 'disabled'}`);
    console.log(`  public paths (SEO manifest): ${publicPaths.size}`);
    console.log(`  s3 proxy -> http://${MINIO_HOST}:${MINIO_PORT}`);
    console.log(`  env: ${envPath}`);
    console.log(
      'Domain HTTPS: put Caddy on 80/443. Direct IP/LAN: open the LAN hint URL (firewall permitting).',
    );
  });
}

main();
