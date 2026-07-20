/**
 * Build-time prerender for public SEO/GEO routes.
 * Usage: node scripts/prerender.mjs [distDir]
 * Requires: playwright (+ chromium via `npx playwright install chromium`)
 *
 * Serves /api/destinations and /api/routes from seo-build-content.json —
 * never returns SPA HTML for /api/*.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  apiDestinationsPayload,
  apiRoutesPayload,
  loadSeoBuildContent,
} from './seo-build-content.mjs';
import { SITE_ORIGIN, getPrerenderRoutes } from './seo-public-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const FORBIDDEN_SNIPPETS = [
  'Destination not found',
  'Route not found',
  'Page not found',
];

function resolveFile(distRoot, urlPathname) {
  const relative = urlPathname === '/' ? 'index.html' : urlPathname.replace(/^\//, '');
  const abs = path.normalize(path.join(distRoot, relative));
  if (!abs.startsWith(distRoot)) return null;
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  const dirIndex = path.normalize(path.join(distRoot, relative, 'index.html'));
  if (dirIndex.startsWith(distRoot) && fs.existsSync(dirIndex) && fs.statSync(dirIndex).isFile()) {
    return dirIndex;
  }
  return null;
}

function expectedCanonical(route) {
  if (route === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${route}`;
}

function assertPrerenderHtml(route, html) {
  if (!html.includes('data-seo-ready="1"')) {
    throw new Error('missing data-seo-ready=1');
  }
  for (const snippet of FORBIDDEN_SNIPPETS) {
    if (html.includes(snippet)) {
      throw new Error(`forbidden snippet: ${snippet}`);
    }
  }
  const canonical = expectedCanonical(route);
  const canonicalOk =
    html.includes(`href="${canonical}"`) || html.includes(`href='${canonical}'`);
  if (!canonicalOk) {
    throw new Error(`missing canonical ${canonical}`);
  }
  if (route !== '/' && html.includes(`href="${SITE_ORIGIN}/"`) && html.includes('rel="canonical"')) {
    // Allow homepage link elsewhere; require the canonical link itself is not homepage.
    const match = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
    if (match && match[0].includes(`href="${SITE_ORIGIN}/"`) && canonical !== `${SITE_ORIGIN}/`) {
      throw new Error('canonical incorrectly points at homepage');
    }
  }
  if (route.startsWith('/destinations/') || route.startsWith('/tours/')) {
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch?.[1] ?? '';
    if (!title || /China Tour Route \| Syncing Travel/i.test(title)) {
      throw new Error(`unresolved detail title: ${title || '(empty)'}`);
    }
  }
}

function startStaticServer(distRoot, snapshot) {
  const spaIndex = path.join(distRoot, 'index.html');
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');

      if (url.pathname === '/api/destinations') {
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(apiDestinationsPayload(snapshot)));
        return;
      }
      if (url.pathname === '/api/routes') {
        const destinationSlug = url.searchParams.get('destination') || undefined;
        res.statusCode = 200;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(apiRoutesPayload(snapshot, destinationSlug)));
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        res.statusCode = 404;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: 'API not available during prerender.' }));
        return;
      }

      const file = resolveFile(distRoot, url.pathname);
      const target = file || spaIndex;
      if (!fs.existsSync(target)) {
        res.statusCode = 404;
        res.end('missing');
        return;
      }
      const ext = path.extname(target).toLowerCase();
      res.statusCode = 200;
      res.setHeader('content-type', MIME[ext] || 'application/octet-stream');
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });
    server.on('error', reject);
  });
}

function outPathForRoute(distRoot, route) {
  if (route === '/') return path.join(distRoot, 'index.html');
  const clean = route.replace(/^\//, '').replace(/\/$/, '');
  return path.join(distRoot, clean, 'index.html');
}

async function main() {
  const distArg = process.argv[2] || 'dist/local';
  const distRoot = path.resolve(appRoot, distArg);
  if (!fs.existsSync(path.join(distRoot, 'index.html'))) {
    console.error(`[prerender] Missing ${distRoot}/index.html — build first.`);
    process.exit(1);
  }

  let snapshot;
  try {
    snapshot = loadSeoBuildContent();
  } catch (error) {
    console.error('[prerender]', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const ROUTES = getPrerenderRoutes();
  if (ROUTES.length === 0) {
    console.error('[prerender] No prerender routes.');
    process.exit(1);
  }

  const { server, port } = await startStaticServer(distRoot, snapshot);
  const origin = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let ok = 0;
  let failed = 0;

  try {
    for (const route of ROUTES) {
      const url = `${origin}${route}`;
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
        await page.waitForFunction(
          () => document.documentElement.dataset.seoReady === '1',
          null,
          { timeout: 20_000 },
        );
        const html = await page.content();
        assertPrerenderHtml(route, html);
        const outFile = outPathForRoute(distRoot, route);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, html, 'utf8');
        ok += 1;
        console.log(`[prerender] OK ${route}`);
      } catch (error) {
        failed += 1;
        console.error(
          `[prerender] FAIL ${route}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`[prerender] done: ${ok} ok, ${failed} failed → ${distRoot}`);
  if (failed > 0 || ok !== ROUTES.length) process.exit(1);
}

main().catch((error) => {
  console.error('[prerender]', error);
  process.exit(1);
});
