import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);

export default defineConfig({
  build: {
    minify: false,
    cssMinify: false
  },
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: 'esjzone-blocker',
        namespace: 'https://github.com/vluxcas/',
        version: packageJson.version,
        description: '批量选择并隐藏 ESJ Zone 小说。',
        author: 'vluxcas',
        homepageURL: 'https://github.com/vluxcas/esjzone-blocker',
        supportURL: 'https://github.com/vluxcas/esjzone-blocker/issues',
        source: 'https://github.com/vluxcas/esjzone-blocker',
        match: ['https://www.esjzone.cc/*', 'https://www.esjzone.one/*'],
        grant: ['GM_getValue', 'GM_setValue', 'GM_addStyle', 'GM_registerMenuCommand'],
        'run-at': 'document-end'
      },
      build: {
        fileName: 'esjzone-blocker.user.js'
      }
    })
  ],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'https://www.esjzone.cc/list-21/' }
    },
    setupFiles: ['./test/setup.js']
  }
});
