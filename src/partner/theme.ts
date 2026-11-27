export type ThemeKey = 'default' | 'teal' | 'indigo' | 'amber' | 'rose';

export interface ThemeDef {
  key: ThemeKey;
  label: string;
  desc: string;
  /** hsl 三段值，直接喂给 --primary / --ring */
  primary: string;
  ring: string;
  /** 选择器里的色块 */
  swatch: string;
}

export const THEMES: ThemeDef[] = [
  {
    key: 'default',
    label: '经典蓝',
    desc: '默认配色，稳重通用',
    primary: '217 91% 60%',
    ring: '217 91% 60%',
    swatch: 'hsl(217 91% 60%)',
  },
  {
    key: 'teal',
    label: '青绿',
    desc: '运输、仓储场景常用',
    primary: '174 72% 40%',
    ring: '174 72% 40%',
    swatch: 'hsl(174 72% 40%)',
  },
  {
    key: 'indigo',
    label: '靛蓝',
    desc: '偏科技感，适合车队管理',
    primary: '243 75% 59%',
    ring: '243 75% 59%',
    swatch: 'hsl(243 75% 59%)',
  },
  {
    key: 'amber',
    label: '琥珀',
    desc: '暖色调，长时间阅读更柔和',
    primary: '32 95% 44%',
    ring: '32 95% 44%',
    swatch: 'hsl(32 95% 44%)',
  },
  {
    key: 'rose',
    label: '玫红',
    desc: '偏零售、快消客户',
    primary: '346 77% 50%',
    ring: '346 77% 50%',
    swatch: 'hsl(346 77% 50%)',
  },
];

const LS_KEY = 'zkzy-partner-theme';
const VALID = new Set<string>(THEMES.map((t) => t.key));

export function isThemeKey(v: unknown): v is ThemeKey {
  return typeof v === 'string' && VALID.has(v);
}

/** 应用到 CSS 变量。shadcn 用 hsl(var(--primary))，所以这里只写三段值。 */
export function applyTheme(key: string | null | undefined) {
  const theme = THEMES.find((t) => t.key === key) ?? THEMES[0];
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--ring', theme.ring);
  root.setAttribute('data-partner-theme', theme.key);
}

export function readCachedTheme(): ThemeKey {
  try {
    const v = localStorage.getItem(LS_KEY);
    return isThemeKey(v) ? v : 'default';
  } catch {
    return 'default';
  }
}

export function cacheTheme(key: ThemeKey) {
  try {
    localStorage.setItem(LS_KEY, key);
  } catch {
    /* localStorage 不可用时忽略 */
  }
}

export function themeOf(key: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}
