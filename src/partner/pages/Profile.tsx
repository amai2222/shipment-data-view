import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Building2,
  Check,
  Copy,
  Info,
  Landmark,
  Loader2,
  Mail,
  Palette,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getProfile, toErrorMessage, type PartnerProfile } from '../api';
import { partnerSupabase } from '../client';
import { THEMES, applyTheme, cacheTheme, readCachedTheme, themeOf, type ThemeKey } from '../theme';
import { ErrorState, EmptyState, InlineError, PageHead } from '../components/shared';

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'min-w-0 break-all text-right text-sm text-foreground',
          mono && 'font-mono text-xs',
        )}
      >
        {value || <span className="text-muted-foreground">未登记</span>}
      </span>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Building2;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-2 divide-y divide-border">{children}</div>
    </section>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeKey>(() => readCachedTheme());
  const [savingTheme, setSavingTheme] = useState<ThemeKey | null>(null);
  const [themeHint, setThemeHint] = useState<string | null>(null);

  const chooseTheme = async (next: ThemeKey) => {
    if (savingTheme || next === theme) return;
    setTheme(next);
    applyTheme(next);
    cacheTheme(next);
    setSavingTheme(next);
    setThemeHint(null);
    try {
      const { error: saveError } = await partnerSupabase.rpc('partner_set_theme', { p_theme: next });
      if (saveError) throw saveError;
      setThemeHint('已保存，该企业下所有账号下次登录生效');
    } catch (err) {
      setThemeHint(toErrorMessage(err, '主题已在本机生效，但未能同步到企业配置'));
    } finally {
      setSavingTheme(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await getProfile());
    } catch (err) {
      setProfile(null);
      setError(toErrorMessage(err, '企业信息加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const account = profile?.bank.bank_account ?? '';
  const groupedAccount = account
    ? account.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
    : '';

  const copyAccount = async () => {
    if (!account) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('复制失败，请长按账号手动选择复制。');
    }
  };

  return (
    <div>
      <PageHead
        title="我的企业"
        description="这里展示平台登记的企业主体、开票信息与收款账户；信息由平台维护，如需变更请联系你的业务经办人。"
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-border bg-card p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-4 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : profile ? (
        <div className="space-y-3">
          <SectionCard
            icon={Building2}
            title="企业信息"
            description="用于合同、对账单与发票抬头的登记信息。"
          >
            <InfoRow label="企业简称" value={profile.partner.name} />
            <InfoRow label="企业全称" value={profile.partner.full_name} />
            <InfoRow label="纳税人识别号" value={profile.partner.tax_number} mono />
            <InfoRow label="合作方 ID" value={profile.partner.id} mono />
          </SectionCard>

          <SectionCard
            icon={Landmark}
            title="收款银行账户"
            description="平台按此账户付款。账户信息只读，如有变更需线下提交变更函。"
          >
            <InfoRow label="开户银行" value={profile.bank.bank_name} />
            <InfoRow label="开户支行" value={profile.bank.branch_name} />
            <div className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <span className="shrink-0 text-xs text-muted-foreground">银行账号</span>
                <div className="min-w-0 text-right">
                  <p className="break-all font-mono text-xs leading-relaxed text-foreground">
                    {groupedAccount || <span className="font-sans text-muted-foreground">未登记</span>}
                  </p>
                  {account ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-7 px-2 text-[11px]"
                      onClick={copyAccount}
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          复制账号
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-1">
                <InlineError message={copyError} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={Palette}
            title="界面主题"
            description="按企业配置：该企业下所有账号登录后统一使用这套配色。"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {THEMES.map((t) => {
                const active = theme === t.key;
                const saving = savingTheme === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => void chooseTheme(t.key)}
                    disabled={savingTheme !== null}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-2.5 text-left transition',
                      active
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:bg-muted/50',
                      savingTheme !== null && !saving && 'opacity-60',
                    )}
                  >
                    <span
                      className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ background: t.swatch }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{t.label}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{t.desc}</span>
                    </span>
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                    ) : active ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {themeHint && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{themeHint}</p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              当前：{themeOf(theme).label}
            </p>
          </SectionCard>

          <SectionCard icon={UserRound} title="登录账号" description="当前登录门户的账号信息。">
            <InfoRow label="联系人" value={profile.user.full_name} />
            <InfoRow label="登录邮箱" value={profile.user.email} />
          </SectionCard>

          <section className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
                <p className="text-sm font-semibold text-foreground">结算与对账说明</p>
                <p>1. 结算金额按运单的应付金额统计，仅展示与你的合作方主体相关的数据。</p>
                <p>2. 对账流程：账单生成 → 门户核对明细 → 确认对账 → 财务安排付款。</p>
                <p>3. 确认对账只代表金额核对无误，实际到账时间以财务付款进度为准。</p>
                <p>4. 发票状态由财务在后台维护；需要开票或修改抬头，请联系业务经办人。</p>
                <p>5. 银行账户变更需提供加盖公章的书面变更函，门户内不支持自助修改。</p>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-center gap-1.5 pb-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            数据仅限本企业查看，操作留痕可追溯
            <Mail className="ml-2 h-3.5 w-3.5" />
            有问题请联系平台运营
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="未查询到企业信息"
          description="当前账号还没有绑定合作方主体，请联系平台运营完成建档。"
          action={
            <Button variant="outline" size="sm" onClick={load}>
              重新加载
            </Button>
          }
        />
      )}
    </div>
  );
}
