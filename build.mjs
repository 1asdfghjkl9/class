// ============================================================
// build.mjs — 打包单文件 HTML（esbuild bundle → 内联进 index.html）
// 用法：node build.mjs
// ============================================================
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const bundlePath = resolve(here, '.bundle.js');
const htmlPath = resolve(here, 'dev.html');          // 开发入口（module 版）
const outLocal = resolve(here, 'index.html');         // 同目录单文件版（可直接双击/手机打开）
const outPath = resolve(here, '..', '班级弹射对战.html'); // 项目顶层交付物

console.log('→ 打包 src/main.js …');
execFileSync('npx', ['esbuild', 'src/main.js', '--bundle', '--format=iife', '--minify',
  '--target=es2020', `--outfile=${bundlePath}`, '--log-level=warning'], {
  cwd: here, stdio: 'inherit',
});

const bundle = readFileSync(bundlePath, 'utf8');
// 内联脚本必须转义 </script>，否则会提前闭合标签
const safeBundle = bundle.replace(/<\/script/gi, '<\\/script');

let html = readFileSync(htmlPath, 'utf8');
const tagRe = /<script\s+type="module"\s+src="\.\/src\/main\.js"\s*><\/script>/;
if (!tagRe.test(html)) {
  console.error('✗ dev.html 里找不到入口 script 标签，请检查');
  process.exit(1);
}
html = html.replace(tagRe, `<script>\n${safeBundle}\n</script>`);
// 单文件版不需要"模块被拦截"提示，但保留节点无副作用
writeFileSync(outLocal, html, 'utf8');
writeFileSync(outPath, html, 'utf8');

if (existsSync(bundlePath)) unlinkSync(bundlePath);

const kb = (statSync(outPath).size / 1024).toFixed(1);
console.log(`✓ 已生成 ${outLocal}`);
console.log(`✓ 已生成 ${outPath}（${kb} KB）`);
