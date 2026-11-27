import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Truck,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getOverview, getReconciliation } from './api';
import { RECONCILE_EVENT, currentMonth, formatCount } from './components/shared';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/overview', label: '概览', icon: LayoutDashboard },
  { to: '/waybills', label: '运单', icon: Truck },
  { to: '/statement', label: '结算', icon: FileText },
  { to: '/reconcile', label: '对账', icon: ClipboardCheck },
  { to: '/profile', label: '我的', icon: Building2 },
];

export default function Layout() {
  const [partnerName, setPartnerName] = useState('合作方');
  const [email, setEmail] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [todoCount, setTodoCount] = useState(0);

  const location = useLocation();

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (alive) setEmail(data.session?.user?.email ?? '');
      } catch {
        /* 读取登录信息失败不影响浏览 */
      }

      try {
        const overview = await getOverview();
        if (alive) setPartnerName(overview.partner.name || '合作方');
      } catch {
        /* 名称仅用于展示，失败时保留默认值 */
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* 待对账角标：页面切换与确认对账后各刷新一次 */
  const refreshTodo = useCallback(async () => {
    try {
      const reconciliation = await getReconciliation(currentMonth());
      setTodoCount(reconciliation.unreconciled_count);
    } catch {
      /* 角标属于辅助信息，失败时保持上一次结果 */
    }
  }, []);

  useEffect(() => {
    void refreshTodo();
  }, [refreshTodo, location.pathname]);

  useEffect(() => {
    const handler = () => {
      void refreshTodo();
    };
    window.addEventListener(RECONCILE_EVENT, handler);
    return () => window.removeEventListener(RECONCILE_EVENT, handler);
  }, [refreshTodo]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      /* 退出接口异常时仍然回到入口页 */
    } finally {
      window.location.replace(import.meta.env.BASE_URL || '/');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Truck className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{partnerName}</p>
            <p className="truncate text-[11px] text-muted-foreground">合作方结算平台</p>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  {item.label}
                  {item.to === '/reconcile' && todoCount > 0 ? (
                    <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold leading-4 text-primary tabular-nums">
                      {todoCount > 99 ? '99+' : formatCount(todoCount)}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            {email ? (
              <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground sm:block">
                {email}
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="退出登录"
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 md:pb-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {item.to === '/reconcile' && todoCount > 0 ? (
                    <span
                      className="absolute -right-2 -top-1.5 min-w-[16px] rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-destructive-foreground tabular-nums"
                      aria-label={`待对账 ${formatCount(todoCount)} 笔`}
                    >
                      {todoCount > 99 ? '99+' : formatCount(todoCount)}
                    </span>
                  ) : null}
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
