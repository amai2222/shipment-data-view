import { useEffect, useState } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import InternalNotice from './InternalNotice';
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
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (!data.session) setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      if (!nextSession) {
        setRole(null);
        setChecking(false);
      }
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 拿到 session 后确认角色：内部员工不应进入合作方门户
  useEffect(() => {
    if (!session) return;
    let alive = true;
    supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setRole((data?.role as string | undefined) ?? null);
        setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    // 与内部系统共用同一登录入口：带着回跳地址去 /auth，登录后按角色回到门户
    const back = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`/auth?redirect=${encodeURIComponent(back)}`);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 内部账号（admin/finance/business/operator/viewer）不进合作方门户
  if (role && role !== 'partner') {
    return <InternalNotice email={session.user.email ?? undefined} />;
  }

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
