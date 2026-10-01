# 由 36.py 注入：0.99 右侧报表生成器（本文件仅作拼接，不单独运行）
REPORT_METHODS = r'''
    def _esc(self, s):
        return html_lib.escape(str(s if s is not None else ""), quote=False)

    def _esc_attr(self, s):
        return html_lib.escape(str(s if s is not None else ""), quote=True)

    def _fmt_money(self, n):
        x = self._d_round(n)
        sign = "-" if x < 0 else ""
        whole, frac = f"{abs(x):.2f}".split(".")
        whole = f"{int(whole):,}"
        return f"{sign}{whole}.{frac}"

    def _fmt_fig(self, n):
        return f"{self._d_round(n):.2f}"

    def _fmt_int(self, n):
        x = int(round(float(n) or 0))
        sign = "-" if x < 0 else ""
        return sign + f"{abs(x):,}"

    def _stamp_pm(self, rate):
        n = round((float(rate) or 0) * 10000 * 10) / 10
        s = f"{n:.1f}"
        if s.endswith(".0"):
            s = s[:-2]
        return s

    def _dual(self, cn, num):
        return f'<span class="f-cn">{self._esc(cn)}</span><span class="f-num">{num}</span>'

    def _tip(self, text):
        if not text:
            return ""
        return f' data-tip="{self._esc_attr(text)}"'

    def _is_fig(self, s):
        t = str(s or "")
        return any(ch in t for ch in "−＋×÷＝") or " + " in t or " - " in t or " = " in t

    def _chip(self, kind, title, cn_text, num_text, value, neg=False, items=None):
        line_html = ""
        if items:
            bits = []
            for it in items:
                fig = self._is_fig(it["num"])
                cls = " is-fig" if fig else ""
                bits.append(
                    f'<div class="line{cls}"><span class="nm">{self._esc(it["name"])}</span>'
                    f'<span class="num">{it["num"]}</span></div>'
                )
            line_html = '<div class="lines">' + "".join(bits) + "</div>"
        show_num = num_text or ""
        if show_num and items:
            compact = show_num.replace(" ", "").replace(",", "").replace("（", "").replace("）", "")
            val = str(value).replace(" ", "").replace(",", "")
            has_rate = any(ch in show_num for ch in "×%‱")
            if not has_rate and (compact == val or compact.endswith("＝" + val)):
                show_num = ""
        d_num = f'<div class="d-num">{show_num}</div>' if show_num else ""
        neg_cls = " neg" if neg else ""
        return (
            f'<div class="tax-chip {kind}"{self._tip(cn_text)}>'
            f'<div class="k">{self._esc(title)}</div>{line_html}{d_num}'
            f'<div class="v{neg_cls}">{value}</div></div>'
        )

    def _099_report_css(self):
        return """
:root {
    --bg: #f4f6f8; --surface: #ffffff; --surface-soft: #f8fafc;
    --line: #e5e7eb; --line-strong: #d1d5db;
    --text: #111827; --text-2: #4b5563; --text-3: #6b7280;
    --brand: #2563eb; --brand-soft: #eff6ff;
    --ok: #059669; --ok-soft: #ecfdf5;
    --danger: #dc2626; --danger-soft: #fef2f2;
    --warn: #d97706; --warn-soft: #fffbeb;
}
* { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; }
html { -webkit-text-size-adjust: 100%; }
body { background: var(--bg); color: var(--text); min-height: 100vh; padding: 20px; }
.card { max-width: 1280px; margin: 0 auto; width: 100%; background: var(--surface); border-radius: 20px; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06); border: 1px solid var(--line); padding: 24px 26px 28px; }
.card-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 18px; border-bottom: 1px solid var(--line); padding-bottom: 14px; gap: 8px; }
.card-header h2 { font-size: 20px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 12px; letter-spacing: -0.2px; min-width: 0; }
.order-badge { background: var(--surface-soft); padding: 6px 14px; border-radius: 999px; font-size: 13px; color: var(--text-2); font-weight: 500; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border: 1px solid var(--line); }
.order-badge .tag { background: var(--surface); padding: 2px 10px; border-radius: 999px; font-weight: 500; color: var(--text-2); border: 1px solid var(--line); }
.tone-qty { background: #eff6ff !important; border-color: #bfdbfe !important; color: #1d4ed8 !important; }
.tone-sur { background: #fffbeb !important; border-color: #fde68a !important; color: #b45309 !important; }
.tone-inc { background: #f5f3ff !important; border-color: #ddd6fe !important; color: #6d28d9 !important; }
.tone-stamp { background: #fff1f2 !important; border-color: #fecdd3 !important; color: #be123c !important; }
.split-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 10px 0 20px; min-width: 0; }
.strip-block { margin: 0 0 14px; min-width: 0; }
.strip-head { font-size: 12px; font-weight: 600; color: var(--text-3); margin-bottom: 6px; letter-spacing: 0.2px; }
.tax-strip { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.tax-chip { background: var(--warn-soft); border: 1px solid #fde68a; border-radius: 12px; padding: 10px 12px; min-width: 0; flex: 1 1 148px; display: flex; flex-direction: column; overflow-x: clip; }
.tax-chip.base { background: var(--ok-soft); border-color: #a7f3d0; }
.tax-chip.base.cost { background: var(--danger-soft); border-color: #fecaca; }
.tax-chip .k { font-size: 12px; color: #92400e; font-weight: 600; letter-spacing: 0.2px; }
.tax-chip.base .k { color: var(--ok); }
.tax-chip.base.cost .k { color: var(--danger); }
.tax-chip .lines { margin: 6px 0 0; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.tax-chip[data-tip], .panel [data-tip], .result-area [data-tip], .footnote [data-tip] { cursor: help; }
.tax-chip .d-num { font-size: 12px; color: var(--text-2); font-weight: 500; margin-top: 6px; line-height: 1.5; font-variant-numeric: tabular-nums; white-space: normal; overflow-wrap: break-word; word-break: break-word; min-width: 0; max-width: 100%; }
.tax-chip .line { display: flex; flex-direction: row; justify-content: space-between; align-items: baseline; gap: 8px; min-width: 0; }
.tax-chip .line.is-fig { flex-direction: column; align-items: stretch; gap: 2px; }
.tax-chip .line .nm { font-size: 11px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; max-width: 100%; }
.tax-chip .line.is-fig .nm { white-space: normal; overflow: visible; text-overflow: unset; }
.tax-chip .line .num { font-size: 12px; color: var(--text-2); font-variant-numeric: tabular-nums; text-align: right; flex: 1 1 auto; min-width: 0; line-height: 1.5; overflow-wrap: break-word; word-break: break-word; }
.tax-chip .line.is-fig .num { text-align: left; flex: 0 1 auto; width: 100%; white-space: normal; }
.tax-chip .v { font-size: 18px; font-weight: 700; color: var(--warn); font-variant-numeric: tabular-nums; margin-top: auto; padding-top: 10px; text-align: right; align-self: stretch; }
.tax-chip.base .v { color: var(--ok); }
.tax-chip.base.cost .v { color: var(--danger); }
.tax-chip .v.neg { color: var(--warn); }
.panel { background: var(--surface-soft); border-radius: 16px; padding: 16px 16px 18px; border: 1px solid var(--line); display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.panel-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--line); padding-bottom: 10px; flex-shrink: 0; color: var(--text); }
.panel-title .badge { font-size: 12px; background: var(--surface); padding: 2px 10px; border-radius: 999px; font-weight: 500; color: var(--text-2); border: 1px solid var(--line); }
.panel-assume { font-size: 11px; font-weight: 400; color: #94a3b8; line-height: 1.55; margin: -2px 0 10px; }
.panel-cash .panel-title { color: #1e3a8a; } .panel-tax .panel-title { color: #92400e; }
.block-positive { background: var(--ok-soft); border-radius: 12px; padding: 10px 14px; margin-bottom: 10px; border-left: 3px solid var(--ok); }
.block-positive .block-label { font-size: 13px; font-weight: 600; color: #047857; margin-bottom: 4px; }
.block-negative { background: var(--danger-soft); border-radius: 12px; padding: 10px 14px; margin-bottom: 10px; border-left: 3px solid var(--danger); }
.block-negative .block-label { font-size: 13px; font-weight: 600; color: #b91c1c; margin-bottom: 4px; }
.block-tax { background: var(--warn-soft); border-radius: 12px; padding: 10px 14px; margin-bottom: 10px; border-left: 3px solid var(--warn); }
.block-tax .block-label { font-size: 13px; font-weight: 600; color: #b45309; margin-bottom: 4px; }
.block-result { background: var(--brand-soft); border-radius: 12px; padding: 10px 14px; border-left: 3px solid var(--brand); margin-top: auto; }
.block-result .block-label { font-size: 13px; font-weight: 600; color: #1d4ed8; margin-bottom: 4px; }
.row-item { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13.5px; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.04); gap: 6px; min-width: 0; }
.row-item:last-of-type { border-bottom: none; }
.row-label { color: var(--text-2); font-weight: 400; font-size: 13.5px; flex: 0 1 auto; min-width: 0; }
.row-detail { color: var(--text-3); font-size: 12px; font-weight: 400; flex: 1 1 auto; text-align: center; padding: 0 6px; display: flex; flex-direction: column; align-items: center; gap: 1px; line-height: 1.4; min-width: 0; overflow-wrap: break-word; word-break: break-word; }
.f-cn, .f-num { font-size: 12px; font-weight: 400; max-width: 100%; line-height: 1.4; }
.f-cn { color: var(--text-3); }
.f-num { color: var(--text-2); font-variant-numeric: tabular-nums; overflow-wrap: break-word; word-break: break-word; }
.row-value { font-weight: 400; font-size: 13.5px; font-variant-numeric: tabular-nums; flex: 0 0 auto; min-width: 70px; text-align: right; color: var(--text-2); }
.row-value.big { font-size: 17px; font-weight: 700; }
.row-value.positive { color: var(--ok); }
.row-value.negative { color: var(--danger) !important; }
.row-value.green { color: var(--ok); }
.row-line, .sub-row { padding-left: 20px; font-size: 13.5px; color: var(--text-2); border-left: 2px solid var(--line); margin-left: 4px; font-weight: 400; }
.row-line .row-label, .sub-row .row-label { font-weight: 400; font-size: 13.5px; color: var(--text-2); min-width: 0; }
.row-line .row-detail, .sub-row .row-detail { font-size: 12px; }
.row-line .row-value, .sub-row .row-value,
.row-line .row-value.positive, .sub-row .row-value.positive,
.row-line .row-value.negative, .sub-row .row-value.negative,
.row-line .row-value.sub-val, .sub-row .row-value.sub-val { color: var(--text-2) !important; font-weight: 400 !important; font-size: 13.5px !important; }
.row-total { font-size: 14px; }
.row-total .row-label { font-weight: 600; font-size: 14px; color: var(--text); }
.row-total .row-detail { font-size: 12px; }
.row-total .row-value { font-weight: 700 !important; font-size: 15px !important; }
.row-total .row-value.positive { color: var(--ok) !important; }
.row-total .row-value.negative { color: var(--danger) !important; }
.row-total .row-value.total-tax { color: var(--warn) !important; }
.row-total .row-value.green { color: var(--ok) !important; }
.row-total .row-value.big { font-size: 17px !important; }
.hl-bold { font-weight: 600; color: var(--text); }
.result-area { background: var(--brand-soft); border-radius: 14px; padding: 14px 20px; margin: 16px 0 8px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; border: 1px solid #bfdbfe; }
.result-item { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.result-item .label { font-size: 14px; color: #1d4ed8; font-weight: 600; }
.result-item .number { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.2px; font-variant-numeric: tabular-nums; }
.result-item .number.green { color: var(--ok); }
.result-item .number.red { color: var(--danger); }
.check-mark { padding: 5px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; }
.check-mark.success { background: var(--ok-soft); color: #047857; border: 1px solid #a7f3d0; }
.check-mark.error { background: var(--danger-soft); color: var(--danger); border: 1px solid #fecaca; }
.footnote { margin-top: 16px; font-size: 13px; color: var(--text-3); background: var(--surface-soft); padding: 10px 16px; border-radius: 12px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 12px; border: 1px solid var(--line); }
.footnote span { font-weight: 500; color: var(--text-2); flex: 1 1 0; min-width: 0; text-align: center; }
#appTip { position: fixed; z-index: 2000; max-width: min(280px, calc(100vw - 16px)); padding: 8px 10px; border-radius: 10px; font-size: 12px; line-height: 1.5; color: #1e3a5f; background: #eef4ff; border: 1px solid #bfdbfe; box-shadow: 0 8px 24px rgba(37,99,235,0.12); pointer-events: none; opacity: 0; transition: opacity 0.15s; }
@media (max-width: 900px) {
    body { padding: 12px; }
    .card { padding: 20px 16px; }
    .card-header h2 { font-size: 16px; }
    .split-panel { grid-template-columns: minmax(0, 1fr); gap: 14px; }
    .tax-chip { flex: 1 1 140px; }
    .row-item { flex-wrap: wrap; align-items: flex-start; }
    .row-detail { flex: 1 1 100%; order: 3; text-align: left; align-items: flex-start; padding: 2px 0 0; }
    .row-value { margin-left: auto; }
    .footnote span { flex: 1 1 calc(50% - 8px); }
}
@media (max-width: 480px) { .tax-chip { flex: 1 1 100%; } .order-badge { width: 100%; } }
"""

    def generate_html_report(self):
        """生成与 0.99 右侧完全一致的精美核算报告"""
        self.calculate_cost()
        cfg = self._collect_ui()
        totals = self._calc_totals(cfg)
        body = self._build_099_report_body(cfg, totals)
        page = (
            "<!DOCTYPE html><html lang=\"zh-CN\"><head>"
            "<meta charset=\"UTF-8\">"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">"
            "<title>单笔业务成本核算 0.99版 · "
            + ("小规模纳税人" if cfg["small"] else "一般纳税人")
            + "</title><style>"
            + self._099_report_css()
            + "</style></head><body>"
            + body
            + self._099_tip_script()
            + "</body></html>"
        )
        file_path = os.path.abspath("cost_report.html")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(page)
        webbrowser.open("file://" + file_path)

    def _099_tip_script(self):
        return r"""
<script>
(function () {
    var tipTimer = null, tipAnchor = null, tipXY = { x: 0, y: 0 };
    function hideAppTip() {
        var el = document.getElementById('appTip');
        if (el) el.style.opacity = '0';
        tipAnchor = null;
        if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
    }
    function placeAppTip(el) {
        var tw = el.offsetWidth, th = el.offsetHeight;
        var left = tipXY.x + 14, top = tipXY.y - th - 12;
        if (top < 8) top = tipXY.y + 16;
        if (left + tw > window.innerWidth - 8) left = tipXY.x - tw - 14;
        if (left < 8) left = 8;
        if (top + th > window.innerHeight - 8) top = Math.max(8, window.innerHeight - th - 8);
        el.style.left = left + 'px'; el.style.top = top + 'px';
    }
    function showAppTip(anchor, e) {
        var text = anchor.getAttribute('data-tip');
        if (!text) return;
        if (e) { tipXY.x = e.clientX; tipXY.y = e.clientY; }
        if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
        tipAnchor = anchor;
        var el = document.getElementById('appTip');
        if (!el) { el = document.createElement('div'); el.id = 'appTip'; document.body.appendChild(el); }
        el.textContent = text; el.style.opacity = '1'; el.style.left = '-999px'; el.style.top = '0';
        requestAnimationFrame(function () { placeAppTip(el); });
        tipTimer = setTimeout(hideAppTip, 5000);
    }
    document.addEventListener('mouseover', function (e) {
        var t = e.target.closest('[data-tip]');
        if (!t || t === tipAnchor) return;
        showAppTip(t, e);
    });
    document.addEventListener('mousemove', function (e) {
        tipXY.x = e.clientX; tipXY.y = e.clientY;
        if (!tipAnchor) return;
        if (e.target.closest('[data-tip]') !== tipAnchor) return;
        var el = document.getElementById('appTip');
        if (el && el.style.opacity !== '0') placeAppTip(el);
    });
    document.addEventListener('mouseout', function (e) {
        var t = e.target.closest('[data-tip]');
        if (!t || t !== tipAnchor) return;
        if (e.relatedTarget && t.contains(e.relatedTarget)) return;
        hideAppTip();
    });
    document.addEventListener('scroll', hideAppTip, true);
})();
</script>
"""

    def _build_099_report_body(self, cfg, t):
        """对齐 0.99 版右侧：利润表项目 chips + 税费 chips + 现金收付 / 利润表"""
        qty = cfg["qty"]
        p_rate = cfg["p_rate"]
        sur_rate = cfg["sur_rate"]
        inc_rate = cfg["inc_rate"]
        stamp_rate = cfg["stamp_rate"]
        up_rate = cfg["up_rate"]
        small = cfg["small"]
        rate_label = "征收率" if small else "销项税率"
        taxpayer = "小规模纳税人" if small else "一般纳税人"
        vat_name = "应纳税额" if small else "销项税额"

        revs_html = []
        rev_excl_html = []
        cost_html = []
        cost_excl_html = []
        rev_cash_nums, rev_excl_nums, cost_cash_nums, cost_excl_nums = [], [], [], []
        rev_excl_items, out_vat_items, cost_excl_items, in_vat_items = [], [], [], []
        stamp_items, tax_deduct_items = [], []

        for r, row in zip(cfg["revs"], t["rev_rows"]):
            cash, excl, out_vat = row["cash"], row["excl"], row["out_vat"]
            name = r["name"]
            if r.get("stamp"):
                stamp_items.append({"name": name + "计税依据", "num": self._fmt_fig(excl)})
            rev_cash_nums.append(self._fmt_money(cash))
            rev_excl_nums.append(self._fmt_fig(excl))
            if r["inc"] and r["rate"] > 0:
                rev_excl_items.append({
                    "name": name + "营业收入",
                    "num": f"{self._fmt_fig(cash)} ÷ {(1 + r['rate']):.2f} ＝ {self._fmt_fig(excl)}"
                })
            else:
                rev_excl_items.append({"name": name + ("营业收入" if r["inc"] else "实收"), "num": self._fmt_fig(cash)})
            if r["rate"] > 0:
                out_vat_items.append({
                    "name": name + vat_name,
                    "num": f"{self._fmt_fig(cash)} − {self._fmt_fig(excl)} ＝ {self._fmt_fig(out_vat)}"
                })
            else:
                out_vat_items.append({"name": name + vat_name, "num": self._fmt_fig(0)})
            tip_cash = "含税收入 = 单价 × 数量。本栏按开票实收，不拆增值税。" if r["inc"] else "实收 = 单价 × 数量。不开票不计提销项税额，流入等于实收。"
            revs_html.append(
                f'<div class="row-item sub-row"{self._tip(tip_cash)}>'
                f'<span class="row-label">📥 {self._esc(name)}{"（含税销售额）" if r["inc"] else "（实收）"}</span>'
                f'<span class="row-detail">{"开票金额" if r["inc"] else "不开票实收"}</span>'
                f'<span class="row-value sub-val">+{self._fmt_money(cash)}</span></div>'
            )
            if r["inc"] and r["rate"] > 0:
                dtl = self._dual("含税销售额 ÷（1＋" + rate_label + "）", f"{self._fmt_money(cash)} ÷ {(1 + r['rate']):.2f}")
                tip_ex = "营业收入 = 含税销售额 ÷（1＋" + rate_label + "）。分母是税率不是税额。"
            else:
                dtl = self._dual("不开票时营业收入等于实收", self._fmt_money(cash))
                tip_ex = "不开票时营业收入 = 实收"
            rev_excl_html.append(
                f'<div class="row-item sub-row"{self._tip(tip_ex)}>'
                f'<span class="row-label">{self._esc(name)}（营业收入）</span>'
                f'<span class="row-detail">{dtl}</span>'
                f'<span class="row-value sub-val">{self._fmt_money(excl)}</span></div>'
            )

        for c, row in zip(cfg["costs"], t["cost_rows"]):
            cash, excl, in_vat = row["cash"], row["excl"], row["in_vat"]
            cost_deduct, tax_deduct = row["cost_deduct"], row["tax_deduct"]
            name = c["name"]
            ticket = c["ticket"]
            if ticket == 3:
                net = self._d_round(c["amt"] * qty)
                cost_html.append(
                    f'<div class="row-item sub-row"{self._tip("含税支出 = 净额 ÷（1 − 代扣税率）。金额栏填承运人净额，本栏为还原后的实付。")}>'
                    f'<span class="row-label">🚛 {self._esc(name)}（含税支出）</span>'
                    f'<span class="row-detail">{self._dual("金额栏为净额，还原为含税支出", self._fmt_money(cash))}</span>'
                    f'<span class="row-value sub-val">−{self._fmt_money(cash)}</span></div>'
                    f'<div class="row-item sub-row"{self._tip("含税支出 = 净额 ÷（1 − 代扣税率）")}>'
                    f'<span class="row-label">代扣还原</span>'
                    f'<span class="row-detail">{self._dual("净额 ÷（1 − 代扣税率）", f"{self._fmt_money(net)} ÷ {(1 - p_rate):.3f}")}</span>'
                    f'<span class="row-value sub-val">{self._fmt_money(cash)}</span></div>'
                )
            else:
                ticket_str = "专用发票（含税支出）" if ticket == 2 else ("普通发票（含税支出）" if ticket == 1 else "无票（含税支出）")
                cost_html.append(
                    f'<div class="row-item sub-row"{self._tip("含税支出 = 单价 × 数量。现金收付不区分进项能否抵扣，按实付列示。")}>'
                    f'<span class="row-label">🤝 {self._esc(name)}（含税支出）</span>'
                    f'<span class="row-detail">{ticket_str}</span>'
                    f'<span class="row-value sub-val">−{self._fmt_money(cash)}</span></div>'
                )
            if c.get("stamp"):
                stamp_items.append({"name": name + "计税依据", "num": self._fmt_fig(row["stamp_excl"])})
            if small:
                cost_cn, cost_num = "小规模纳税人不能抵扣进项，营业成本等于价税合计", self._fmt_fig(cash)
            elif ticket == 3:
                cost_cn = "含税支出 ÷（1＋销项税率）；代扣进项按销项税率拆分，不是按税额"
                cost_num = f"{self._fmt_fig(cash)} ÷ {(1 + up_rate):.2f} ＝ {self._fmt_fig(cost_deduct)}"
            elif in_vat > 0 and c["rate"] > 0:
                cost_cn = "含税支出 ÷（1＋进项税率）"
                cost_num = f"{self._fmt_fig(cash)} ÷ {(1 + c['rate']):.2f} ＝ {self._fmt_fig(cost_deduct)}"
            else:
                cost_cn = "普通发票不得抵扣进项，营业成本按价税合计" if ticket == 1 else "无票不得抵扣进项，营业成本按实付金额"
                cost_num = self._fmt_fig(cash)
            cost_excl_html.append(
                f'<div class="row-item sub-row"{self._tip(cost_cn)}>'
                f'<span class="row-label">{self._esc(name)}（营业成本）</span>'
                f'<span class="row-detail">{self._dual(cost_cn, cost_num)}</span>'
                f'<span class="row-value sub-val">{self._fmt_money(cost_deduct)}</span></div>'
            )
            cost_cash_nums.append(self._fmt_money(cash))
            cost_excl_nums.append(self._fmt_fig(cost_deduct))
            cost_excl_items.append({"name": name + "营业成本", "num": cost_num})
            if in_vat > 0:
                in_vat_items.append({
                    "name": name + "进项税额",
                    "num": f"{self._fmt_fig(cash)} − {self._fmt_fig(excl)} ＝ {self._fmt_fig(in_vat)}"
                })
            else:
                in_vat_items.append({"name": name + "进项税额", "num": self._fmt_fig(0)})
            if tax_deduct > 0:
                tax_deduct_items.append({
                    "name": name + "税前扣除",
                    "num": self._fmt_fig(excl) if ticket in (2, 3) else self._fmt_fig(cash)
                })

        unused = t["unused_vat"]
        if unused > 0:
            cost_excl_nums.append(self._fmt_fig(unused))
            cost_excl_items.append({
                "name": "未抵扣进项税额",
                "num": f"{self._fmt_fig(t['in_vat'])} − {self._fmt_fig(t['out_vat'])} ＝ {self._fmt_fig(unused)}"
            })
            tax_deduct_items.append({"name": "未抵扣进项税额", "num": self._fmt_fig(unused)})
            cost_excl_html.append(
                f'<div class="row-item sub-row"{self._tip("未抵扣进项税额 = 进项税额 − 销项税额。本单未抵完部分计入营业成本，不得确认为利润。")}>'
                f'<span class="row-label">未抵扣进项税额计入成本</span>'
                f'<span class="row-detail">{self._dual("进项税额 − 销项税额；本单未抵完部分计入营业成本", f"{self._fmt_fig(t['in_vat'])} − {self._fmt_fig(t['out_vat'])}")}</span>'
                f'<span class="row-value sub-val">{self._fmt_money(unused)}</span></div>'
            )

        pay_vat, sur, stamp = t["pay_vat"], t["sur"], t["stamp"]
        inc_tax, tax_add = t["inc_tax"], t["tax_add"]
        cash_margin, net, pbt, f2 = t["cash_margin"], t["net_profit"], t["profit_before_tax"], t["f2_profit"]
        total_tax = t["total_tax"]
        taxable_inc = t["taxable_inc"]

        vat_burden = f"{(pay_vat / t['rev_excl']) * 100:.2f}" if t["rev_excl"] > 0 else "—"
        real_burden = f"{(total_tax / t['rev_excl']) * 100:.2f}" if t["rev_excl"] > 0 else "—"
        cost_excl_num = " ＋ ".join(cost_excl_nums) or self._fmt_fig(0)
        rev_cash_num = " ＋ ".join(rev_cash_nums) or self._fmt_money(0)
        rev_excl_num = " ＋ ".join(rev_excl_nums) or self._fmt_fig(0)
        cost_cash_num = " ＋ ".join(cost_cash_nums) or self._fmt_money(0)
        if stamp_items:
            stamp_num = (
                "（" + " ＋ ".join(it["num"] for it in stamp_items)
                + f" ＝ {self._fmt_fig(t['stamp_base'])}）× {self._stamp_pm(stamp_rate)}‱ ＝ {self._fmt_fig(stamp)}"
            )
        else:
            stamp_num = self._fmt_fig(0)
        tax_add_num = f"{self._fmt_fig(sur)} ＋ {self._fmt_fig(stamp)}"
        sur_num = f"{self._fmt_fig(pay_vat)} × {(sur_rate * 100):.0f}% ＝ {self._fmt_fig(sur)}"
        cash_margin_num = f"{self._fmt_fig(t['cash_rev'])} − {self._fmt_fig(t['cash_cost'])}"
        cash_profit_num = f"{self._fmt_fig(cash_margin)} − {self._fmt_fig(pay_vat)} − {self._fmt_fig(tax_add)} − {self._fmt_fig(inc_tax)}"
        pbt_num = f"{self._fmt_fig(t['rev_excl'])} − {self._fmt_fig(t['cost_excl'])} − {self._fmt_fig(tax_add)}"
        pnl_num = f"{self._fmt_fig(pbt)} − {self._fmt_fig(inc_tax)}"
        deduct_differs = abs(t["tax_deduct"] - t["cost_excl"]) >= 0.01
        if deduct_differs:
            inc_cn = "所得税费用 =（营业收入 − 税前扣除 − 税金及附加）× 企业所得税率；无票不得扣除，应纳税所得额为负时不征"
            inc_base = t["tax_deduct"]
        else:
            inc_cn = "所得税费用 =（营业收入 − 营业成本 − 税金及附加）× 企业所得税率；应纳税所得额为负时不征"
            inc_base = t["cost_excl"]
        inner = f"（{self._fmt_fig(t['rev_excl'])} − {self._fmt_fig(inc_base)} − {self._fmt_fig(tax_add)} ＝ {self._fmt_fig(taxable_inc)}）"
        inc_num = inner + (f"× {(inc_rate * 100):.0f}% ＝ {self._fmt_fig(inc_tax)}" if taxable_inc > 0 else f"＝ {self._fmt_fig(0)}")
        if unused > 0:
            vat_pay_cn = "应交增值税 = 销项税额 − 进项税额；进项大于销项时本期应交为 0"
            vat_pay_num = f"{self._fmt_fig(t['out_vat'])} − {self._fmt_fig(t['in_vat'])} ＝ {self._fmt_fig(0)}"
        else:
            vat_pay_cn = "应交增值税 = 销项税额 − 进项税额"
            vat_pay_num = f"{self._fmt_fig(t['out_vat'])} − {self._fmt_fig(t['in_vat'])} ＝ {self._fmt_fig(pay_vat)}"

        unused_chip = ""
        if unused > 0:
            unused_chip = self._chip(
                "tax", "未抵扣进项税额",
                "未抵扣进项税额 = 进项税额 − 销项税额；本单未抵完部分计入营业成本",
                f"{self._fmt_fig(t['in_vat'])} − {self._fmt_fig(t['out_vat'])} ＝ {self._fmt_fig(unused)}",
                self._fmt_money(unused), False
            )
        deduct_chip = ""
        if deduct_differs:
            deduct_chip = self._chip(
                "base", "税前扣除",
                "企业所得税税前扣除 = 专用发票按不含税金额 ＋ 普通发票按价税合计；无票不得扣除",
                " ＋ ".join(it["num"] for it in tax_deduct_items) + f" ＝ {self._fmt_fig(t['tax_deduct'])}",
                self._fmt_money(t["tax_deduct"]), False, tax_deduct_items
            )
        rev_excl_join = " ＋ ".join(rev_excl_nums)
        if len(rev_excl_nums) > 1:
            rev_excl_join += f" ＝ {self._fmt_fig(t['rev_excl'])}"
        cost_excl_join = " ＋ ".join(cost_excl_nums)
        if len(cost_excl_nums) > 1:
            cost_excl_join += f" ＝ {self._fmt_fig(t['cost_excl'])}"
        out_bits = [it["num"].split(" ＝ ")[-1] for it in out_vat_items]
        out_vat_join = " ＋ ".join(out_bits)
        if len(out_vat_items) > 1:
            out_vat_join += f" ＝ {self._fmt_fig(t['out_vat'])}"
        elif len(out_vat_items) == 1:
            out_vat_join = out_vat_items[0]["num"]
        in_bits = [it["num"].split(" ＝ ")[-1] if "＝" in it["num"] else it["num"] for it in in_vat_items]
        in_vat_join = " ＋ ".join(in_bits)
        if len(in_vat_items) > 1:
            in_vat_join += f" ＝ {self._fmt_fig(t['in_vat'])}"
        elif len(in_vat_items) == 1:
            in_vat_join = in_vat_items[0]["num"]

        rev_tip = "营业收入 = 含税销售额 ÷（1＋征收率）。不开票时：营业收入 = 实收" if small else "营业收入 = 含税销售额 ÷（1＋销项税率）。分母是税率不是税额。不开票时：营业收入 = 实收"
        cost_tip = "营业成本 = 价税合计（小规模纳税人不得抵扣进项税额）" if small else "营业成本 = 专用发票按不含税金额；普通发票、无票按价税合计"
        vat_chip_cn = "应纳税额 = 含税销售额 − 营业收入（按征收率）" if small else "销项税额 = 含税销售额 − 营业收入"
        in_chip_cn = "进项税额 = 0（小规模纳税人不得抵扣进项税额）" if small else "进项税额 = 专用发票、代扣代缴的（价税合计 − 不含税金额）；普通发票、无票不得抵扣"
        pay_chip_cn = "应交增值税 = 应纳税额（小规模纳税人不得抵扣进项税额）" if small else vat_pay_cn

        ok = abs(net - f2) < 0.01
        sign_cm = "+" if cash_margin >= 0 else ""
        sign_net = "+" if net >= 0 else ""
        sign_pbt = "+" if pbt >= 0 else ""
        sign_f2 = "+" if f2 >= 0 else ""
        net_cls = "green" if net >= 0 else "negative"
        f2_cls = "green" if f2 >= 0 else "negative"
        num_cls = "green" if net >= 0 else "red"
        chk_cls = "success" if ok else "error"
        chk_txt = "✔ 现金净流量与净利润一致" if ok else "❌ 两项金额不一致"
        vb = "" if vat_burden == "—" else "%"
        rb = "" if real_burden == "—" else "%"

        return f"""
<div class="card">
    <div class="card-header">
        <h2>📋 单笔业务成本核算（{taxpayer} · 现金收付 VS 利润表）</h2>
        <div class="order-badge">
            <span class="tag">{taxpayer}</span>
            <span class="tag tone-qty">数量 {self._fmt_int(qty)}</span>
            <span class="tag tone-sur">附加税费 {(sur_rate*100):.0f}%</span>
            <span class="tag tone-inc">企业所得税率 {(inc_rate*100):.0f}%</span>
            <span class="tag tone-stamp">印花税 {self._stamp_pm(stamp_rate)}‱</span>
        </div>
    </div>
    <div class="strip-block">
        <div class="strip-head">利润表项目 · 只计算一次</div>
        <div class="tax-strip">
            {self._chip("base", "营业收入", rev_tip, rev_excl_join, self._fmt_money(t["rev_excl"]), False, rev_excl_items)}
            {self._chip("base cost", "营业成本", cost_tip, cost_excl_join, self._fmt_money(t["cost_excl"]), False, cost_excl_items)}
            {deduct_chip}
        </div>
    </div>
    <div class="strip-block">
        <div class="strip-head">税费项目 · 引用上方结果</div>
        <div class="tax-strip">
            {self._chip("tax", vat_name, vat_chip_cn, out_vat_join, self._fmt_money(t["out_vat"]), False, out_vat_items)}
            {self._chip("tax", "进项税额", in_chip_cn, in_vat_join, self._fmt_money(t["in_vat"]), False, in_vat_items)}
            {self._chip("tax", "应交增值税", pay_chip_cn, vat_pay_num, self._fmt_money(pay_vat), True)}
            {unused_chip}
            {self._chip("tax", "附加税费", "附加税费 = 应交增值税 × 附加税费率", f"{self._fmt_fig(pay_vat)} × {(sur_rate * 100):.0f}% ＝ {self._fmt_fig(sur)}", self._fmt_money(sur), True)}
            {self._chip("tax", "印花税", "印花税 = 勾选项目计税依据合计 × 印花税率", stamp_num, self._fmt_money(stamp), True, stamp_items)}
            {self._chip("tax", "所得税费用", inc_cn, inc_num, self._fmt_money(inc_tax), True)}
        </div>
    </div>
    <div class="split-panel">
        <div class="panel panel-cash">
            <div class="panel-title"{self._tip("按实收实付列示含税金额。增值税现金要付，利润表不列。假设本期计提的税费均于当期缴纳。")}>💰 现金收付 <span class="badge">含税口径</span></div>
            <div class="panel-assume">假设本期计提的税费均于当期缴纳（实缴增值税、实缴税金及附加、实缴所得税）。未实际缴纳时现金不会流出。</div>
            <div class="block-positive">
                <div class="block-label"{self._tip("客户支付的款项。开票为含税销售额（开票金额），不开票为实收。")}>⬆ 含税收入</div>
                {''.join(revs_html)}
                <div class="row-item row-total"{self._tip("含税收入合计 = 各项含税收入相加")}>
                    <span class="row-label">含税收入合计</span>
                    <span class="row-detail">{self._dual("各项含税收入相加", rev_cash_num)}</span>
                    <span class="row-value positive">+{self._fmt_money(t["cash_rev"])}</span>
                </div>
            </div>
            <div class="block-negative">
                <div class="block-label"{self._tip("支付给承运人、居间人等的款项。开票为含税支出，代扣为净额还原后的含税支出。")}>⬇ 含税支出</div>
                {''.join(cost_html)}
                <div class="row-item row-total"{self._tip("含税支出合计 = 各项含税支出相加")}>
                    <span class="row-label">含税支出合计</span>
                    <span class="row-detail">{self._dual("各项含税支出相加", cost_cash_num)}</span>
                    <span class="row-value negative">−{self._fmt_money(t["cash_cost"])}</span>
                </div>
            </div>
            <div class="block-tax">
                <div class="block-label"{self._tip("增值税是价外税：假设当期实缴。利润表不列增值税。本栏不并入税金及附加。")}>⬇ 实缴增值税</div>
                <div class="row-item sub-row"{self._tip(vat_pay_cn)}>
                    <span class="row-label">{"应纳税额" if small else "销项税额 − 进项税额"}</span>
                    <span class="row-detail">{self._dual("应纳税额（不得抵扣进项税额）" if small else "销项税额 − 进项税额", vat_pay_num)}</span>
                    <span class="row-value sub-val">{self._fmt_money(pay_vat)}</span>
                </div>
                <div class="row-item row-total"{self._tip("实缴增值税按本期应交增值税，假设于当期缴纳。进项大于销项时本期实缴为 0。")}>
                    <span class="row-label">实缴增值税合计</span>
                    <span class="row-detail">{self._dual("应纳税额" if small else "销项税额 − 进项税额", self._fmt_fig(pay_vat))}</span>
                    <span class="row-value total-tax">−{self._fmt_money(pay_vat)}</span>
                </div>
            </div>
            <div class="block-tax">
                <div class="block-label"{self._tip("现金缴纳的税金及附加，假设与利润表税金及附加同额并于当期缴纳。不含增值税，不含企业所得税。")}>⬇ 实缴税金及附加</div>
                <div class="row-item sub-row"{self._tip("附加税费 = 实缴增值税 × 附加税费率，含城市维护建设税、教育费附加、地方教育附加。")}>
                    <span class="row-label">附加税费</span>
                    <span class="row-detail">{self._dual("实缴增值税 × 附加税费率", sur_num)}</span>
                    <span class="row-value sub-val">{self._fmt_money(sur)}</span>
                </div>
                <div class="row-item sub-row"{self._tip("印花税列入税金及附加。= 勾选项目计税依据合计 × 印花税率。居间合同不征。")}>
                    <span class="row-label">印花税</span>
                    <span class="row-detail">{self._dual("计税依据 × 印花税率", stamp_num)}</span>
                    <span class="row-value sub-val">{self._fmt_money(stamp)}</span>
                </div>
                <div class="row-item row-total"{self._tip("实缴税金及附加 = 附加税费 ＋ 印花税。本单假设与利润表同额并于当期缴纳。")}>
                    <span class="row-label">实缴税金及附加合计</span>
                    <span class="row-detail">{self._dual("附加税费 ＋ 印花税", tax_add_num)}</span>
                    <span class="row-value total-tax">−{self._fmt_money(tax_add)}</span>
                </div>
            </div>
            <div class="block-tax">
                <div class="block-label"{self._tip("现金缴纳的企业所得税。本单假设与利润表所得税费用同额并于当期缴纳，不并入税金及附加。")}>⬇ 实缴所得税</div>
                <div class="row-item sub-row"{self._tip(inc_cn)}>
                    <span class="row-label">企业所得税</span>
                    <span class="row-detail">{self._dual("应纳税所得额 × 企业所得税率", inc_num)}</span>
                    <span class="row-value sub-val">{self._fmt_money(inc_tax)}</span>
                </div>
                <div class="row-item row-total"{self._tip("实缴所得税合计 = 企业所得税。本单假设于当期缴纳；应纳税所得额为负时为 0。")}>
                    <span class="row-label">实缴所得税合计</span>
                    <span class="row-detail">{self._dual("企业所得税", self._fmt_fig(inc_tax))}</span>
                    <span class="row-value total-tax">−{self._fmt_money(inc_tax)}</span>
                </div>
            </div>
            <div class="block-result">
                <div class="block-label"{self._tip("现金净流量应与右侧净利润勾稽一致。")}>📊 结果</div>
                <div class="row-item sub-row"{self._tip("含税收支净额 = 含税收入合计 − 含税支出合计（尚未扣税）")}>
                    <span class="row-label">含税收支净额</span>
                    <span class="row-detail">{self._dual("含税收入合计 − 含税支出合计", cash_margin_num)}</span>
                    <span class="row-value sub-val">{sign_cm}{self._fmt_money(cash_margin)}</span>
                </div>
                <div class="row-item row-total" style="border-bottom: none;"{self._tip("现金净流量 = 含税收支净额 − 实缴增值税 − 实缴税金及附加 − 实缴所得税。应与右侧净利润一致。")}>
                    <span class="row-label">① 现金净流量</span>
                    <span class="row-detail">{self._dual("含税收支净额 − 实缴增值税 − 实缴税金及附加 − 实缴所得税", cash_profit_num)}</span>
                    <span class="row-value big {net_cls}">{sign_net}{self._fmt_money(net)}</span>
                </div>
            </div>
        </div>
        <div class="panel panel-tax">
            <div class="panel-title"{self._tip("按会计准则列示：收入、成本用不含税金额；税金及附加与所得税费用分列；增值税不进利润表。")}>🧾 利润表 <span class="badge">不含税口径</span></div>
            <div class="block-positive">
                <div class="block-label"{self._tip("确认的营业收入。开票：含税销售额 ÷（1＋销项税率或征收率），分母是税率不是税额；不开票：等于实收。")}>⬆ 营业收入</div>
                {''.join(rev_excl_html)}
                <div class="row-item row-total"{self._tip("营业收入合计 = 各项营业收入相加")}>
                    <span class="row-label">营业收入合计</span>
                    <span class="row-detail">{self._dual("各项营业收入相加", rev_excl_num)}</span>
                    <span class="row-value positive">{self._fmt_money(t["rev_excl"])}</span>
                </div>
            </div>
            <div class="block-negative">
                <div class="block-label"{self._tip("专用发票、代扣按不含税金额；普通发票、无票按价税合计；本单未抵完进项计入营业成本。")}>⬇ 营业成本</div>
                {''.join(cost_excl_html)}
                <div class="row-item row-total"{self._tip("营业成本合计 = 各项营业成本相加")}>
                    <span class="row-label">营业成本合计</span>
                    <span class="row-detail">{self._dual("各项营业成本相加", cost_excl_num)}</span>
                    <span class="row-value negative">−{self._fmt_money(t["cost_excl"])}</span>
                </div>
            </div>
            <div class="block-tax">
                <div class="block-label"{self._tip("税金及附加含城市维护建设税、教育费附加、地方教育附加及印花税。增值税是价外税，不进利润表。")}>⬇ 税金及附加</div>
                <div class="row-item sub-row"{self._tip("附加税费 = 应交增值税 × 附加税费率，含城市维护建设税、教育费附加、地方教育附加。")}>
                    <span class="row-label">附加税费</span>
                    <span class="row-detail">{self._dual("应交增值税 × 附加税费率", sur_num)}</span>
                    <span class="row-value sub-val">{self._fmt_money(sur)}</span>
                </div>
                <div class="row-item sub-row"{self._tip("印花税列入税金及附加。= 勾选项目计税依据合计 × 印花税率。居间合同不征。")}>
                    <span class="row-label">印花税</span>
                    <span class="row-detail">{self._dual("计税依据 × 印花税率", stamp_num)}</span>
                    <span class="row-value sub-val">{self._fmt_money(stamp)}</span>
                </div>
                <div class="row-item row-total"{self._tip("税金及附加 = 附加税费 ＋ 印花税。不含增值税，不含所得税费用。")}>
                    <span class="row-label">税金及附加合计</span>
                    <span class="row-detail">{self._dual("附加税费 ＋ 印花税", tax_add_num)}</span>
                    <span class="row-value total-tax">−{self._fmt_money(tax_add)}</span>
                </div>
            </div>
            <div class="block-tax">
                <div class="block-label"{self._tip("所得税费用为计提的企业所得税，单独列示，不并入税金及附加。")}>⬇ 所得税费用</div>
                <div class="row-item sub-row"{self._tip(inc_cn)}>
                    <span class="row-label">企业所得税</span>
                    <span class="row-detail">{self._dual("应纳税所得额 × 企业所得税率", inc_num)}</span>
                    <span class="row-value sub-val">{self._fmt_money(inc_tax)}</span>
                </div>
                <div class="row-item row-total"{self._tip("所得税费用合计 = 企业所得税。应纳税所得额为负时为 0。")}>
                    <span class="row-label">所得税费用合计</span>
                    <span class="row-detail">{self._dual("企业所得税", self._fmt_fig(inc_tax))}</span>
                    <span class="row-value total-tax">−{self._fmt_money(inc_tax)}</span>
                </div>
            </div>
            <div class="block-result">
                <div class="block-label"{self._tip("先算利润总额，再减所得税费用得到净利润。应与左侧现金净流量勾稽一致。")}>📊 结果</div>
                <div class="row-item sub-row"{self._tip("利润总额 = 营业收入合计 − 营业成本合计 − 税金及附加。本单无期间费用、营业外收支。")}>
                    <span class="row-label">利润总额</span>
                    <span class="row-detail">{self._dual("营业收入合计 − 营业成本合计 − 税金及附加", pbt_num)}</span>
                    <span class="row-value sub-val">{sign_pbt}{self._fmt_money(pbt)}</span>
                </div>
                <div class="row-item row-total" style="border-bottom: none;"{self._tip("净利润 = 利润总额 − 所得税费用。应与左侧现金净流量一致。增值税已从收入成本中剔除，不在本式出现。")}>
                    <span class="row-label">② 净利润</span>
                    <span class="row-detail">{self._dual("利润总额 − 所得税费用", pnl_num)}</span>
                    <span class="row-value big {f2_cls}">{sign_f2}{self._fmt_money(f2)}</span>
                </div>
            </div>
        </div>
    </div>
    <div class="result-area"{self._tip("勾稽关系：现金净流量 = 净利润。左边扣实缴增值税（假设当期缴纳），右边收入成本已剔除增值税，两边结果应一致。")}>
        <div class="result-item">
            <span class="label">✅ 交叉验证</span>
            <span class="number {num_cls}">{self._fmt_money(net)}</span>
            <span style="color:#2a4f77; font-weight:500;">= {self._fmt_money(f2)}</span>
            <span class="check-mark {chk_cls}">{chk_txt}</span>
        </div>
    </div>
    <div class="footnote">
        <span data-tip="开票为含税销售额，不开票为实收">📌 含税收入 {self._fmt_money(t["cash_rev"])}</span>
        <span data-tip="营业收入 = 含税销售额 ÷（1＋销项税率或征收率），分母是税率不是税额；不开票时等于实收">📌 营业收入 {self._fmt_money(t["rev_excl"])}</span>
        <span data-tip="成本付现：开票为含税支出，代扣为还原后的含税支出">📌 含税支出 {self._fmt_money(t["cash_cost"])}</span>
        <span data-tip="专用发票、代扣按不含税金额；普通发票、无票按含税支出；本单未抵完进项计入营业成本">📌 营业成本 {self._fmt_money(t["cost_excl"])}</span>
        <span data-tip="假设本期计提均于当期缴纳：实缴增值税 ＋ 实缴税金及附加 ＋ 实缴所得税">📌 税费合计 {self._fmt_money(total_tax)}</span>
        <span data-tip="增值税税负 = 应交增值税 ÷ 营业收入。税务风险分析常用此口径">📊 增值税税负 {vat_burden}{vb}</span>
        <span data-tip="实际税负 = 税费合计 ÷ 营业收入。分母不用含税收入，否则会低估税负">📊 实际税负 {real_burden}{rb}</span>
    </div>
</div>
"""
'''
