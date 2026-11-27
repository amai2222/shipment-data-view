/**
 * 让旧页面在部署后依然能加载旧 chunk。
 *
 * 问题：Cloudflare Pages 每次部署只保留当前构建的 assets。
 * 用户停在旧页面时点菜单，请求的是旧 hash 的 chunk（已被删除）→ 404 → 页面加载失败。
 *
 * 做法：构建完成后，把线上上一版 asset-manifest.json 里列出的文件
 * 从当前线上补回 dist/assets。这样新旧两套 chunk 同时存在，
 * 旧页面无需刷新也能正常工作。
 *
 * 只保留「上一版」，不做无限累积，dist 体积可控。
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const DIST = path.resolve(process.env.DIST_DIR || 'dist');
const ASSETS = path.join(DIST, 'assets');
const ORIGIN = (process.env.CARRY_OVER_ORIGIN || 'https://ynzkzy.325218.xyz').replace(/\/+$/, '');
const MANIFEST = 'asset-manifest.json';

function listAssets() {
  if (!fs.existsSync(ASSETS)) return [];
  return fs
    .readdirSync(ASSETS)
    .filter((f) => !f.startsWith('.') && fs.statSync(path.join(ASSETS, f)).isFile());
}

function fetchJson(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function download(url, dest) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 25000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(false);
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve(true)));
      out.on('error', () => resolve(false));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  if (!fs.existsSync(ASSETS)) {
    console.log('[carry-over] 未找到 dist/assets，跳过');
    return;
  }

  const before = new Set(listAssets());
  const online = await fetchJson(`${ORIGIN}/${MANIFEST}?_=${Date.now()}`);
  const previous = Array.isArray(online?.assets) ? online.assets : [];

  if (previous.length === 0) {
    console.log('[carry-over] 线上暂无 asset-manifest.json（首次启用），本次只生成清单');
  }

  let carried = 0;
  let failed = 0;
  for (const file of previous) {
    // 只允许安全文件名，防路径穿越
    if (typeof file !== 'string' || !/^[A-Za-z0-9._-]+$/.test(file)) continue;
    if (before.has(file)) continue;

    const ok = await download(`${ORIGIN}/assets/${file}`, path.join(ASSETS, file));
    if (ok) carried += 1;
    else failed += 1;
  }

  const all = listAssets();
  fs.writeFileSync(
    path.join(DIST, MANIFEST),
    JSON.stringify({ generatedAt: new Date().toISOString(), count: all.length, assets: all }, null, 2),
  );

  console.log(
    `[carry-over] 上一版 ${previous.length} 个，补回 ${carried} 个，失败 ${failed} 个，本次产物共 ${all.length} 个`,
  );
}

main().catch((err) => {
  // 补回失败不应阻断部署
  console.warn('[carry-over] 执行异常，已忽略:', err?.message || err);
});
