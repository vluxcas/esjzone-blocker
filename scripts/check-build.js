import { readFile } from 'node:fs/promises';

const output = await readFile(new URL('../dist/esjzone-blocker.user.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8')
);
const requiredMetadata = [
  '// @name         esjzone-blocker',
  '// @namespace    https://github.com/vluxcas/',
  `// @version      ${packageJson.version}`,
  '// @author       vluxcas',
  '// @homepageURL  https://github.com/vluxcas/esjzone-blocker',
  '// @source       https://github.com/vluxcas/esjzone-blocker',
  '// @supportURL   https://github.com/vluxcas/esjzone-blocker/issues',
  '// @match        https://www.esjzone.cc/*',
  '// @match        https://www.esjzone.one/*',
  '// @run-at       document-end',
  '// @grant        GM_addStyle',
  '// @grant        GM_getValue',
  '// @grant        GM_registerMenuCommand',
  '// @grant        GM_setValue'
];

for (const line of requiredMetadata) {
  if (!output.includes(line)) {
    throw new Error(`构建产物缺少元数据：${line}`);
  }
}

console.log('用户脚本元数据检查通过');
