import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const configPath = path.join(repoRoot, 'data/pipeline.config.json');

const args = parseArgs(process.argv.slice(2));
const intakePath = args.intake ?? '路线_新';
const limit = args.limit ? Number(args.limit) : null;
const mineruBin = args.mineruBin ?? process.env.MINERU_BIN ?? 'mineru';
const mineruPython = args.python ?? process.env.MINERU_PYTHON ?? null;
const backend = args.backend ?? process.env.MINERU_BACKEND ?? 'pipeline';
const method = args.method ?? process.env.MINERU_METHOD ?? 'auto';
const mode = args.mode ?? process.env.MINERU_MODE ?? (mineruPython ? 'python-api' : 'cli');
const force = Boolean(args.force);

const config = JSON.parse(await readFile(configPath, 'utf8'));
const outputRoot = path.join(repoRoot, config.structuredData.extractedDir, 'mineru');
const reportPath = path.join(repoRoot, config.structuredData.reportsDir, 'mineru-extraction-report.json');

const supportedExtensions = new Set(['.pdf', '.docx', '.doc', '.xlsx', '.xls']);
const inputRoot = path.resolve(repoRoot, intakePath);
const files = [];

if (!existsSync(inputRoot)) {
  throw new Error(`Raw intake folder does not exist: ${normalizePath(path.relative(repoRoot, inputRoot))}`);
}

for await (const filePath of walkFiles(inputRoot)) {
  const extension = path.extname(filePath).toLowerCase();
  if (!supportedExtensions.has(extension)) continue;
  files.push(filePath);
}

files.sort((a, b) => normalizePath(a).localeCompare(normalizePath(b), 'zh-Hans-CN'));

const selectedFiles = limit ? files.slice(0, limit) : files;
const generatedAt = new Date().toISOString();
const results = [];

await mkdir(outputRoot, { recursive: true });
await mkdir(path.dirname(reportPath), { recursive: true });

for (const filePath of selectedFiles) {
  const relativePath = normalizePath(path.relative(repoRoot, filePath));
  const rawFileId = makeRawId(relativePath);
  const perFileOutputDir = path.join(outputRoot, rawFileId);
  const startedAt = new Date().toISOString();
  const existingTracePath = path.join(perFileOutputDir, 'source-trace.json');

  await mkdir(perFileOutputDir, { recursive: true });

  const result = {
    rawFileId,
    sourcePath: relativePath,
    extension: path.extname(filePath).toLowerCase(),
    startedAt,
    finishedAt: null,
    status: 'pending',
    outputDir: normalizePath(path.relative(repoRoot, perFileOutputDir)),
    command: {
      mode,
      bin: mode === 'python-api' ? mineruPython : mineruBin,
      args:
        mode === 'python-api'
          ? ['scripts/travel-data/mineru_api_runner.py', relativePath, normalizePath(path.relative(repoRoot, perFileOutputDir)), backend, method]
          : ['-p', relativePath, '-o', normalizePath(path.relative(repoRoot, perFileOutputDir)), '-b', backend, '-m', method],
    },
    stdout: '',
    stderr: '',
    warnings: [],
  };

  if (!force && existsSync(existingTracePath)) {
    try {
      const existingTrace = JSON.parse(await readFile(existingTracePath, 'utf8'));
      if (existingTrace.status === 'extracted') {
        result.status = 'skipped';
        result.finishedAt = new Date().toISOString();
        result.warnings.push('Skipped because an extracted source trace already exists. Use --force to reparse.');
        results.push(result);
        console.log(`skipped: ${relativePath}`);
        continue;
      }
    } catch {
      result.warnings.push('Existing source trace could not be read; reparsing.');
    }
  }

  try {
    const commandResult =
      mode === 'python-api'
        ? await runMineruPythonApi(mineruPython, filePath, perFileOutputDir, backend, method)
        : await runMineru(mineruBin, filePath, perFileOutputDir, backend, method);
    result.stdout = commandResult.stdout;
    result.stderr = commandResult.stderr;
    result.status = commandResult.exitCode === 0 ? 'extracted' : 'failed';

    if (commandResult.exitCode !== 0) {
      result.warnings.push(`MinerU exited with code ${commandResult.exitCode}.`);
    }
  } catch (error) {
    result.status = 'failed';
    result.stderr = error instanceof Error ? error.message : String(error);
    result.warnings.push('MinerU invocation failed. Check whether MinerU is installed and available on PATH.');
  }

  result.finishedAt = new Date().toISOString();

  await writeFile(
    path.join(perFileOutputDir, 'source-trace.json'),
    JSON.stringify(
      {
        rawFileId,
        sourcePath: relativePath,
        extractedAt: result.finishedAt,
        extractor: 'MinerU',
        extractorMode: mode,
        extractorCommand: result.command,
        status: result.status,
        warnings: result.warnings,
      },
      null,
      2,
    ),
    'utf8',
  );

  results.push(result);
  console.log(`${result.status}: ${relativePath}`);
}

await writeFile(
  reportPath,
  JSON.stringify(
    {
      generatedAt,
      intakePath: normalizePath(path.relative(repoRoot, inputRoot)),
      extractor: 'MinerU',
      extractorMode: mode,
      mineruBin,
      mineruPython,
      backend,
      method,
      totalSupportedFiles: files.length,
      attemptedFiles: selectedFiles.length,
      extractedCount: results.filter((item) => item.status === 'extracted').length,
      skippedCount: results.filter((item) => item.status === 'skipped').length,
      failedCount: results.filter((item) => item.status === 'failed').length,
      results,
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Wrote MinerU report to ${normalizePath(path.relative(repoRoot, reportPath))}`);

async function runMineruPythonApi(pythonPath, inputFile, outputDir, selectedBackend, selectedMethod) {
  if (!pythonPath) {
    throw new Error('MINERU_PYTHON or --python is required when mode is python-api.');
  }

  return runProcess(pythonPath, [
    path.join(scriptDir, 'mineru_api_runner.py'),
    inputFile,
    outputDir,
    selectedBackend,
    selectedMethod,
  ]);
}

async function runMineru(bin, inputFile, outputDir, selectedBackend, selectedMethod) {
  const commandArgs = ['-p', inputFile, '-o', outputDir, '-b', selectedBackend, '-m', selectedMethod];

  return runProcess(bin, commandArgs);
}

function runProcess(bin, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, commandArgs, {
      cwd: repoRoot,
      windowsHide: true,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

async function* walkFiles(folder) {
  const entries = await readdir(folder, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(folder, entry.name);

    if (entry.isDirectory()) {
      yield* walkFiles(entryPath);
      continue;
    }

    if (entry.isFile()) {
      yield entryPath;
    }
  }
}

function makeRawId(value) {
  return `raw_${createHash('sha1').update(normalizePath(value)).digest('hex').slice(0, 16)}`;
}

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) continue;

    const key = value.slice(2);
    const next = values[index + 1];

    if (!next || next.startsWith('--')) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function normalizePath(value) {
  return value.split(path.sep).join('/');
}
