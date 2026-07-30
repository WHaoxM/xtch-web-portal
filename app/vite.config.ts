import path from "path"
import fs from "node:fs"
import type { IncomingMessage } from 'node:http'
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'
import { localApiRoutes, rawBodyRoutes } from './scripts/localApiRoutes'
import { loadTargetEnv, normalizeTarget } from '../scripts/env/targetEnv'
import { assertTargetEnvValid, isProdDeployTarget } from '../scripts/env/validateTargetEnv'

type VercelResponseLike = {
  status: (code: number) => VercelResponseLike;
  json: (body: unknown) => void;
  send: (body: string) => void;
};

function localApiPlugin(): Plugin {
  return {
    name: 'local-vercel-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const apiPath = req.url?.split('?')[0] ?? '';
        const modulePath = localApiRoutes[apiPath];

        if (!modulePath) {
          next();
          return;
        }

        try {
          const useRawBody = rawBodyRoutes.has(apiPath);
          const body = useRawBody ? await readRawBody(req) : await readJsonBody(req);
          const { default: handler } = await server.ssrLoadModule(modulePath);
          const response: VercelResponseLike = {
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

          await handler(
            {
              method: req.method,
              headers: req.headers,
              url: req.url,
              body,
              socket: { remoteAddress: req.socket?.remoteAddress },
            },
            response,
          );
        } catch (error) {
          console.error('Local API request failed:', error);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: 'Local API request failed.' }));
        }
      });
    },
  };
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return undefined;

  return JSON.parse(raw) as unknown;
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);
  // Canonical secrets: env/<target>/.env (legacy app/.env.*.local still falls back).
  // Re-apply with override so Vite in-process restarts pick up edited secrets.
  const target = normalizeTarget(mode);
  const loaded = loadTargetEnv(target, { override: true });
  if (isProdDeployTarget(target)) {
    assertTargetEnvValid(target, process.env, loaded?.path);
  }

  const outDir = path.join('dist', target);

  return {
    // Absolute base required for BrowserRouter deep links (/destinations/…).
    base: '/',
    plugins: [
      localApiPlugin(),
      // Local DX: Vite on Windows can spend ~500–600ms per image on 304 revalidation
      // when many Home/China Trips imgs load at once. Long max-age skips that on refresh.
      // Content editors replacing same-path files should hard-refresh once after edits.
      {
        name: 'xtch-dev-static-cache',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url?.split('?')[0] ?? '';
            if (url.startsWith('/images/') || url.startsWith('/s3/')) {
              res.setHeader('Cache-Control', 'public, max-age=3600');
            }
            next();
          });
        },
      },
      inspectAttr(),
      react(),
      {
        name: 'xtch-write-build-target-marker',
        closeBundle() {
          const markerDir = path.resolve(__dirname, outDir);
          fs.mkdirSync(markerDir, { recursive: true });
          fs.writeFileSync(
            path.join(markerDir, '.xtch-build-target'),
            `${target}\n`,
            'utf8',
          );
        },
      },
    ],
    build: {
      outDir,
      emptyOutDir: true,
    },
    // Default crawl is all *.html under root, ignoring only *current* build.outDir.
    // Other target dirs (dist/win11-home, dist/cloud-vps) and any legacy flat
    // dist/index.html would still be scanned; their bundles may contain
    // motion's optional require("@emotion/is-prop-valid") and fail the scan.
    optimizeDeps: {
      entries: ['index.html'],
    },
    server: {
      port: 3000,
      strictPort: true,
      host: '127.0.0.1',
      // Quick tunnels send Host: *.trycloudflare.com; Vite blocks unknown hosts by default.
      ...(mode === 'tunnel' ? { allowedHosts: ['.trycloudflare.com'] as string[] } : {}),
      // Same-origin /s3 → MinIO so tunnel browsers can PUT/GET with Host matching
      // the Cloudflare URL used in S3_ENDPOINT (see docs/ops/tunnel-testbed.md).
      proxy: {
        '/s3': {
          target: 'http://127.0.0.1:9000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/s3/, ''),
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
