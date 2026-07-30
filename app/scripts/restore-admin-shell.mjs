import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const adminSrc = execSync('git show HEAD:app/src/pages/Admin.tsx', {
  cwd: path.resolve(root, '..'),
  encoding: 'utf8',
});
const fixed = adminSrc.replace(/from '\.\.\/lib\//g, "from '@/lib/");
const adminDest = path.join(src, 'shells', 'admin', 'Admin.tsx');
fs.mkdirSync(path.dirname(adminDest), { recursive: true });
fs.writeFileSync(adminDest, fixed, 'utf8');
fs.writeFileSync(
  path.join(src, 'pages', 'Admin.tsx'),
  "export { default } from '@/shells/admin/Admin';\n",
  'utf8',
);
console.log('Restored shells/admin/Admin.tsx from git');
