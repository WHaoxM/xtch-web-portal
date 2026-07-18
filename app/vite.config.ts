import path from "path"
import type { IncomingMessage } from 'node:http'
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'
import { localApiRoutes, rawBodyRoutes } from './scripts/localApiRoutes'
import { loadTargetEnv, normalizeTarget } from '../scripts/env/targetEnv'

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
  loadTargetEnv(target, { override: true });

  return {
    base: './',
    plugins: [localApiPlugin(), inspectAttr(), react()],
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
