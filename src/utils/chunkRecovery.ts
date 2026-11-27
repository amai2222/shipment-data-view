/**
 * 懒加载 chunk 失效的自动恢复。
 *
 * 场景：用户停留在旧页面期间发了新版本 → 旧 hash 的 chunk 已被新部署删除 →
 * 点菜单时 `import()` 404。此时唯一正确的做法是整页刷新，让浏览器拿到新 index.html。
 *
 * 关键点：重试次数必须存在 sessionStorage（跨 reload 有效），
 * 存在组件 state 里 reload 后会归零，等于无限刷新。
 */

const KEY = 'zkzy:chunk-reload';
const MAX_ATTEMPTS = 2;
const WINDOW_MS = 60_000;

export function isChunkLoadError(input: unknown): boolean {
  const anyInput = input as { message?: string; name?: string } | string | undefined;
  const msg = String(
    typeof anyInput === 'string' ? anyInput : anyInput?.message ?? '',
  ).toLowerCase();
  const name = String(
    typeof anyInput === 'string' ? '' : anyInput?.name ?? '',
  ).toLowerCase();

  return (
    name === 'chunkloaderror' ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('unable to preload') ||
    msg.includes('chunkloaderror')
  );
}

function readAttempt(): number {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { count?: number; at?: number };
    if (!parsed?.at || Date.now() - parsed.at > WINDOW_MS) return 0;
    return Number(parsed.count) || 0;
  } catch {
    return 0;
  }
}

function writeAttempt(count: number) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ count, at: Date.now() }));
  } catch {
    /* 隐私模式下 sessionStorage 不可用时忽略，退化为不自动刷新 */
  }
}

/** 启动成功后清理计数，避免下次真出问题时没有额度 */
export function markAppLoadedOk() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 命中 chunk 错误则刷新页面。
 * @returns true = 已触发刷新（调用方不要再展示错误 UI）
 */
export function tryRecoverFromChunkError(err: unknown): boolean {
  if (!isChunkLoadError(err)) return false;

  const attempts = readAttempt();
  if (attempts >= MAX_ATTEMPTS) return false;

  writeAttempt(attempts + 1);

  // 带时间戳参数，绕过浏览器与 CDN 的任何中间缓存
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_r', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
  return true;
}

/**
 * 探测线上 index.html 的入口 chunk 是否与本页不同（= 有新版本）。
 * 用于「停留期间的主动提示」，可选调用。
 */
export async function detectNewVersion(): Promise<boolean> {
  try {
    const res = await fetch(`/index.html?_=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;

    const html = await res.text();
    const online = html.match(/assets\/(?:index|main)-[A-Za-z0-9_-]+\.js/);
    if (!online) return false;

    const currentSrc = Array.from(document.querySelectorAll('script[src]'))
      .map((el) => el.getAttribute('src') || '')
      .find((src) => /assets\/(?:index|main)-/.test(src));
    if (!currentSrc) return false;

    const onlineFile = online[0].split('/').pop();
    return !!onlineFile && !currentSrc.endsWith(onlineFile);
  } catch {
    return false;
  }
}
