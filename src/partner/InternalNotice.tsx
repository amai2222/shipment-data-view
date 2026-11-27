import { partnerSupabase as supabase } from '@/partner/client';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

/**
 * 内部账号误入合作方门户的提示页。
 * partner_* 接口对内部账号一律 42501，与其让页面显示「加载失败」，
 * 不如在这里说清楚，并给出两条出路。
 */
export default function InternalNotice({ email }: { email?: string }) {
  const signOutAndBack = async () => {
    await supabase.auth.signOut();
    window.location.replace('/auth');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
        </div>

        <h2 className="mt-4 text-base font-semibold">当前是内部账号</h2>

        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          合作方门户只对分包商、货主账号开放，
          {email ? (
            <>
              <br />
              <span className="text-foreground font-medium break-all">{email}</span> 是内部员工账号。
            </>
          ) : null}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={() => window.location.replace('/')}>进入内部系统</Button>
          <Button variant="outline" onClick={signOutAndBack}>
            换一个合作方账号
          </Button>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          如需预览门户，请使用 partner01@zkzy.local 这类合作方账号登录
        </p>
      </div>
    </div>
  );
}
