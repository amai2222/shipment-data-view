import { useEffect, useState } from 'react';
import { partnerSupabase } from './client';
import { applyTheme, cacheTheme, readCachedTheme, isThemeKey, ThemeKey } from './theme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Loader2, Truck } from 'lucide-react';

/**
 * 合作方门户独立登录页。
 * 与内部系统使用不同的 storageKey，登录态互不影响。
 */
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    applyTheme(readCachedTheme());
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (!email.trim() || !password) {
      setError('请输入账号和密码');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await partnerSupabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError('账号或密码不正确，请核对后重试');
        return;
      }

      // 登录后立即校验是否绑定了合作方，并顺手取主题
      const { data: theme, error: rpcError } = await partnerSupabase.rpc('partner_get_theme');
      if (rpcError) {
        await partnerSupabase.auth.signOut();
        const msg = rpcError.message || '';
        setError(
          msg.includes('未绑定')
            ? '该账号尚未绑定合作方，请联系业务对接人开通'
            : msg.includes('仅对合作方')
            ? '该账号是内部账号，请从内部系统登录'
            : '登录后校验失败，请稍后重试',
        );
        return;
      }

      if (isThemeKey(theme)) {
        cacheTheme(theme as ThemeKey);
        applyTheme(theme);
      }
      // 成功后由 App 的 onAuthStateChange 接管
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-base font-semibold leading-tight">合作方结算平台</div>
            <div className="text-xs text-muted-foreground">运单 · 结算 · 对账</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-muted-foreground">
              登录账号
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs text-muted-foreground">
              密码
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <span className="text-xs text-destructive leading-relaxed">{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                登录中
              </>
            ) : (
              '登录'
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground leading-relaxed">
          账号由业务对接人开通，忘记密码请联系对接人重置
        </p>
      </div>
    </div>
  );
}
