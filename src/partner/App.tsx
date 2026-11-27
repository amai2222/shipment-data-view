import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import Waybills from './pages/Waybills';
import Statement from './pages/Statement';
import StatementDetail from './pages/StatementDetail';
import Reconcile from './pages/Reconcile';
import Profile from './pages/Profile';

/**
 * 路由前缀 /partner：
 * - 部署在子目录（VITE base）时自动带上子目录前缀
 * - 直接以 partner.html 打开时没有服务端 rewrite，使用 hash 路由，刷新不会 404
 * - 若站点已把 /partner/* 重写到 partner.html，则自动使用 history 路由
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');
const PARTNER_BASENAME = `${BASE}/partner`;
const HTML_ENTRY = /\.html?$/i.test(window.location.pathname);

// hash 路由下把 "#/overview" 这类旧链接补齐为 "#/partner/overview"
if (HTML_ENTRY) {
  const raw = window.location.hash.replace(/^#/, '');
  const hasPrefix = raw === PARTNER_BASENAME || raw.startsWith(`${PARTNER_BASENAME}/`);
  if (!hasPrefix) {
    const rest = raw ? (raw.startsWith('/') ? raw : `/${raw}`) : '/overview';
    const next = `${PARTNER_BASENAME}${rest}`;
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#${next}`,
    );
  }
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Dashboard />} />
        <Route path="/waybills" element={<Waybills />} />
        <Route path="/statement" element={<Statement />} />
        <Route path="/statement/:month" element={<StatementDetail />} />
        <Route path="/reconcile" element={<Reconcile />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  if (HTML_ENTRY) {
    return (
      <HashRouter basename={PARTNER_BASENAME}>
        <AppRoutes />
      </HashRouter>
    );
  }

  return (
    <BrowserRouter basename={PARTNER_BASENAME}>
      <AppRoutes />
    </BrowserRouter>
  );
}
