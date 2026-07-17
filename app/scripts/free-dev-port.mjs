/**
 * Free the Vite dev port (default 3000) before starting `npm run dev`.
 * Prevents Vite from hopping to 3001/3002 when a previous Agent left a server running.
 */
import { execSync } from 'node:child_process';

const PORT = Number(process.env.DEV_PORT || 3000);

function listeningPids(port) {
  if (process.platform === 'win32') {
    let out = '';
    try {
      out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
    } catch {
      return [];
    }

    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      // TCP  127.0.0.1:3000  0.0.0.0:0  LISTENING  12345
      const local = parts[1] ?? '';
      if (!local.endsWith(`:${port}`)) continue;
      const pid = Number(parts[parts.length - 1]);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  }

  try {
    const out = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    return out
      .split(/\s+/)
      .map(Number)
      .filter((pid) => Number.isFinite(pid) && pid > 0);
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
    console.log(`[free-dev-port] Freed :${PORT} (killed PID ${pid})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[free-dev-port] Could not kill PID ${pid}: ${message}`);
  }
}

const pids = listeningPids(PORT);
if (pids.length === 0) {
  console.log(`[free-dev-port] Port ${PORT} is already free`);
} else {
  for (const pid of pids) killPid(pid);
}
