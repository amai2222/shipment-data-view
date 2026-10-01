import tkinter as tk
from tkinter import ttk, messagebox
import webbrowser
import os
import json
import html as html_lib
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import math
import traceback

class LogisticsCalculator:
    """多维物流成本与税务核算工具"""
    
    DEFAULT_CONFIG = {
        'platform_rate': 0.071,
        'surcharge_rate': 0.06,
        'income_tax_rate': 0.05,
        'stamp_tax_rate': 0.0003,
        'default_vat_rate': 0.09,
        'qty': 1.0
    }
    
    COST_STATE_MAP = {
        0: {'label': '🚫 没票', 'color': 'red', 'rate': '0', 'desc': '无票支出'},
        1: {'label': '✅ 普票', 'color': '#0078D7', 'rate': '0.01', 'desc': '普票(全额计成本)'},
        2: {'label': '✅ 专票', 'color': 'green', 'rate': '0.09', 'desc': '专票(可抵扣进项)'},
        3: {'label': '🏢 平台', 'color': 'purple', 'rate': '-', 'desc': '平台专票'}
    }

    def __init__(self, root):
        self.root = root
        self.root.title("多维物流成本与税务（财务核算透明计算平台）")
        try:
            self.root.state("zoomed")
        except Exception:
            self.root.geometry("1800x900")
        
        self._setup_styles()
        self.rev_items = []
        self.cost_items = []
        self.report_data = {}
        self.taxpayer = 'general'
        self.v_use_platform = tk.BooleanVar(value=False)
        
        self.setup_ui()
        self.add_rev_row("物流收入", "55", "0.09", True)
        self.add_cost_row("司机运费", "40", "0.01", 1) 
        self.add_cost_row("居间费含", "10", "0.01", 2)
        
    def _d_round(self, value):
        return float(Decimal(str(value)).quantize(Decimal('0.00'), rounding=ROUND_HALF_UP))

    def in_pref_tax_window(self, d=None):
        d = d or datetime.now()
        return datetime(2023, 1, 1) <= d <= datetime(2027, 12, 31, 23, 59, 59)

    def default_rates(self):
        pref = self.in_pref_tax_window()
        return {
            'pref': pref,
            'surcharge_pct': 6 if pref else 12,
            'income_pct': 5 if pref else 25,
            'stamp_permyriad': 1.5 if pref else 3,
            'small_vat_pct': 1 if pref else 3
        }

    def _setup_styles(self):
        """配置Treeview样式"""
        style = ttk.Style()
        style.configure("Treeview", font=("Microsoft YaHei", 10), rowheight=30)
        style.configure("Treeview.Heading", font=("Microsoft YaHei", 10, "bold"))
        style.map("Treeview", background=[('selected', '#e1e1e1')], foreground=[('selected', 'black')])

    def setup_ui(self):
        """构建主界面"""
        self.paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.paned.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self._setup_left_panel()
        self._setup_right_panel()
        
        # 调整分隔条位置
        self.root.after(200, lambda: self.paned.sashpos(0, int(self.root.winfo_width() * 0.38)))

    def _setup_left_panel(self):
        """构建左侧输入面板"""
        self.left_frame = ttk.Frame(self.paned)
        self.paned.add(self.left_frame, weight=2)
        self._setup_action_buttons()
        self._setup_scrollable_area()
        self._setup_settings_frame()
        self._setup_rev_frame()
        self._setup_cost_frame()

    def _setup_settings_frame(self):
        """全局与税务设置"""
        settings_frame = ttk.LabelFrame(self.scrollable_frame, text=" ⚙️ 全局与税务设置 ", padding=12)
        settings_frame.pack(fill="x", pady=5, padx=5)
        
        self.btn_platform = tk.Button(
            settings_frame, text="⬜ 启用下游平台模式(关闭)",
                                      fg="gray", font=("Microsoft YaHei", 11, "bold"),
            relief="flat", cursor="hand2", command=self.toggle_platform_mode
        )
        self.btn_platform.grid(row=0, column=0, columnspan=2, padx=5, pady=8, sticky="w")
        
        self.lbl_plat_rate = tk.Label(
            settings_frame, text="平台真实税点:", fg="purple", font=("Microsoft YaHei", 10, "bold")
        )
        self.entry_plat_rate = ttk.Entry(settings_frame, width=8, font=("Microsoft YaHei", 10))
        self.entry_plat_rate.insert(0, str(self.DEFAULT_CONFIG['platform_rate']))
        
        tk.Label(
            settings_frame, text="业务份数/规模(份):", fg="#d93025", font=("Microsoft YaHei", 10, "bold")
        ).grid(row=0, column=4, padx=5, pady=8, sticky="e")
        self.entry_qty = ttk.Entry(settings_frame, width=8, font=("Microsoft YaHei", 10, "bold"))
        self.entry_qty.insert(0, str(self.DEFAULT_CONFIG['qty']))
        self.entry_qty.grid(row=0, column=5, padx=5, pady=8, sticky="w")
        
        ttk.Label(settings_frame, text="附加税率:").grid(row=1, column=0, padx=5, pady=8, sticky="w")
        self.entry_surcharge = ttk.Entry(settings_frame, width=8)
        self.entry_surcharge.insert(0, str(self.DEFAULT_CONFIG['surcharge_rate']))
        self.entry_surcharge.grid(row=1, column=1, padx=5, sticky="w")
        
        ttk.Label(settings_frame, text="所得税率:").grid(row=1, column=2, padx=5, pady=8, sticky="e")
        self.entry_income_tax = ttk.Entry(settings_frame, width=8)
        self.entry_income_tax.insert(0, str(self.DEFAULT_CONFIG['income_tax_rate']))
        self.entry_income_tax.grid(row=1, column=3, padx=5, sticky="w")
        
        ttk.Label(settings_frame, text="印花税率:").grid(row=1, column=4, padx=5, pady=8, sticky="e")
        self.entry_stamp = ttk.Entry(settings_frame, width=8)
        self.entry_stamp.insert(0, str(self.DEFAULT_CONFIG['stamp_tax_rate']))
        self.entry_stamp.grid(row=1, column=5, padx=5, sticky="w")

        for ent in (self.entry_qty, self.entry_surcharge, self.entry_income_tax, self.entry_stamp, self.entry_plat_rate):
            ent.bind("<KeyRelease>", lambda e: self.calculate_cost())

    def _setup_rev_frame(self):
        """营业收入项"""
        self.rev_frame = ttk.LabelFrame(
            self.scrollable_frame, text=" 💰 营业收入项 (填入单价，自动算总额) ", padding=12
        )
        self.rev_frame.pack(fill="x", pady=10, padx=5)
        ttk.Button(self.rev_frame, text="➕ 添加收入项", command=lambda: self.add_rev_row()).pack(anchor="w", pady=5)
        self.rev_container = ttk.Frame(self.rev_frame)
        self.rev_container.pack(fill="x")

    def _setup_cost_frame(self):
        """运营支出项"""
        self.cost_frame = ttk.LabelFrame(
            self.scrollable_frame, text=" 💸 运营支出项 (填入单价，自动算总额) ", padding=12
        )
        self.cost_frame.pack(fill="x", pady=10, padx=5)
        ttk.Button(self.cost_frame, text="➕ 添加支出项", command=lambda: self.add_cost_row()).pack(anchor="w", pady=5)
        self.cost_container = ttk.Frame(self.cost_frame)
        self.cost_container.pack(fill="x")

    def _setup_action_buttons(self):
        """底部操作按钮"""
        self.bottom_frame = ttk.Frame(self.left_frame)
        self.bottom_frame.pack(side="bottom", fill="x", pady=10)
        
        btn_frame = ttk.Frame(self.bottom_frame)
        btn_frame.pack(fill="x", padx=10)
        
        btn_calc = tk.Button(btn_frame, text="🚀 一键手动刷新核算", 
                             bg="#0078D7", fg="white", font=("Microsoft YaHei", 12, "bold"), 
                             relief="flat", cursor="hand2", command=self.calculate_cost)
        btn_calc.pack(side="left", fill="x", expand=True, ipady=10, padx=(0, 5))
        
        btn_report = tk.Button(btn_frame, text="📊 生成并预览精美核算报告", 
                               bg="#1a7a4a", fg="white", font=("Microsoft YaHei", 12, "bold"), 
                               relief="flat", cursor="hand2", command=self.generate_html_report)
        btn_report.pack(side="right", fill="x", expand=True, ipady=10, padx=(5, 0))

    def _setup_scrollable_area(self):
        """可滚动区域"""
        self.canvas = tk.Canvas(self.left_frame, highlightthickness=0)
        self.scrollbar = ttk.Scrollbar(self.left_frame, orient="horizontal", command=self.canvas.xview)
        self.scrollbar_y = ttk.Scrollbar(self.left_frame, orient="vertical", command=self.canvas.yview)
        self.scrollable_frame = ttk.Frame(self.canvas)
        
        self.canvas_window = self.canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        
        def sync_canvas_width(event=None):
            c_w = self.canvas.winfo_width()
            r_w = self.scrollable_frame.winfo_reqwidth()
            self.canvas.itemconfig(self.canvas_window, width=max(c_w, r_w))
            self.canvas.configure(scrollregion=self.canvas.bbox("all"))
            
        self.scrollable_frame.bind("<Configure>", sync_canvas_width)
        self.canvas.bind("<Configure>", sync_canvas_width)
        
        self.canvas.configure(xscrollcommand=self.scrollbar.set, yscrollcommand=self.scrollbar_y.set)
        
        self.scrollbar.pack(side="bottom", fill="x")
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar_y.pack(side="right", fill="y")
        self.root.bind_all("<MouseWheel>", self._on_mousewheel)

    def _setup_right_panel(self):
        """右侧结果展示面板"""
        self.right_frame = ttk.Frame(self.paned)
        self.paned.add(self.right_frame, weight=3) 
        
        columns = ('item', 'amt_inc', 'amt_exc', 'desc')
        
        tree_scroll_y = ttk.Scrollbar(self.right_frame, orient="vertical")
        tree_scroll_x = ttk.Scrollbar(self.right_frame, orient="horizontal")
        
        self.tree = ttk.Treeview(self.right_frame, columns=columns, show='headings',
                                 yscrollcommand=tree_scroll_y.set, xscrollcommand=tree_scroll_x.set)
        
        tree_scroll_y.config(command=self.tree.yview)
        tree_scroll_x.config(command=self.tree.xview)
        
        tree_scroll_y.pack(side="right", fill="y")
        tree_scroll_x.pack(side="bottom", fill="x")
        self.tree.pack(fill="both", expand=True)
        
        self.tree.heading('item', text='核算项目')
        self.tree.heading('amt_inc', text='含税总额(元)')
        self.tree.heading('amt_exc', text='不含税总额(元)')
        self.tree.heading('desc', text='详细计算逻辑与公式明细')
        
        self.tree.column('item', width=220, minwidth=150, anchor='w', stretch=True)
        self.tree.column('amt_inc', width=130, minwidth=110, anchor='center', stretch=False)
        self.tree.column('amt_exc', width=130, minwidth=110, anchor='center', stretch=False)
        self.tree.column('desc', width=650, minwidth=400, anchor='w', stretch=True)
        
        self.tree.tag_configure('separator', foreground='#aaaaaa')
        self.tree.tag_configure('header', font=("Microsoft YaHei", 10, "bold"), background="#f0f0f0")
        self.tree.tag_configure('highlight', foreground='#d93025', font=("Microsoft YaHei", 11, "bold"))
        self.tree.tag_configure('success', foreground='green', font=("Microsoft YaHei", 11, "bold"))

    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1*(event.delta/120)), "units")

    def _refresh_policy_note(self):
        r = self.default_rates()
        if r['pref']:
            head = "已按系统日期套用 2023-01-01～2027-12-31 的优惠默认值：附加税费 6%、印花税 1.5‱、企业所得税 5%；切换为小规模纳税人时征收率默认 1%。居间服务默认免征印花税。"
        else:
            head = "优惠期已结束，默认改为：附加税费 12%、印花税 3‱、企业所得税 25%；切换为小规模纳税人时征收率默认 3%。居间服务默认免征印花税。"
        if hasattr(self, 'lbl_policy'):
            self.lbl_policy.config(text=head + " 附加税费率为城市维护建设税、教育费附加、地方教育附加合计。")

    def show_guide(self):
        r = self.default_rates()
        vat_note = "1%" if r['pref'] else "3%"
        messagebox.showinfo("必看说明",
            "1. 本页按「单笔业务」测算，不按月汇总销售额。切换为小规模纳税人时，仅默认按征收率计税，不会因「月销售额不超过 10 万元」自动免税。\n\n"
            "2. 企业所得税默认 5%，对应小型微利企业的实际税负。系统不校验年应纳税所得额、从业人数、资产总额。不属于小微请改企业所得税率。\n\n"
            "3. 附加税费率为城建税、教育费附加、地方教育附加合计。市区常见未减半约 12%，优惠期减半填 6%。\n\n"
            "4. 营业成本：专用发票按不含税金额；普通发票和无票按含税支出。\n\n"
            "5. 一般纳税人销项税率默认 9%，不适用小规模增值税减免。\n\n"
            "6. 左侧现金收付假设本期计提的税费均于当期缴纳。\n\n"
            f"小规模默认征收率 {vat_note}。"
        )

    def set_taxpayer(self, mode):
        if mode in ('general', 'small'):
            self.taxpayer = mode
            self.calculate_cost()

    def toggle_platform_mode(self):
        """切换平台模式"""
        current = self.v_use_platform.get()
        self.v_use_platform.set(not current)
        
        if self.v_use_platform.get():
            self.btn_platform.config(text="✅ 启用下游平台模式(开启)", fg="purple")
            self.lbl_plat_rate.grid(row=0, column=2, padx=5, pady=8, sticky="e")
            self.entry_plat_rate.grid(row=0, column=3, padx=5, pady=8, sticky="w")
            for item in self.cost_items:
                if "司机" in item['name'].get():
                    item['state'].set(3)
                    self.update_cost_visuals(item, auto_fill=True)
        else:
            self.btn_platform.config(text="⬜ 启用下游平台模式(关闭)", fg="gray")
            self.lbl_plat_rate.grid_remove()
            self.entry_plat_rate.grid_remove()
            for item in self.cost_items:
                if item['state'].get() == 3:
                    item['state'].set(1) 
                    self.update_cost_visuals(item, auto_fill=True)
        self.calculate_cost()

    def toggle_rev_btn(self, var, btn, e_rate):
        """切换收入项含税/不含税"""
        is_inc = not var.get()
        var.set(is_inc)
        if is_inc:
            btn.config(text="✅ 含税金额", fg="green")
            e_rate.config(state="normal")
            e_rate.delete(0, tk.END)
            e_rate.insert(0, str(self.DEFAULT_CONFIG['default_vat_rate']))
        else:
            btn.config(text="⬜ 不含税金额", fg="gray")
            e_rate.config(state="normal")
            e_rate.delete(0, tk.END)
            e_rate.insert(0, "0")
        self.calculate_cost()

    def toggle_cost_state(self, item_dict):
        """切换成本项票据状态"""
        name = item_dict['name'].get()
        if "司机" in name and self.v_use_platform.get():
            max_state = 4
        else:
            max_state = 3
        val = (item_dict['state'].get() + 1) % max_state
        item_dict['state'].set(val)
        self.update_cost_visuals(item_dict, auto_fill=True)
        self.calculate_cost()

    def update_cost_visuals(self, item, auto_fill=True):
        """更新成本项显示"""
        val = item['state'].get()
        btn = item['btn_state']
        e_rate = item['rate']
        state_info = self.COST_STATE_MAP.get(val, self.COST_STATE_MAP[0])
        btn.config(text=state_info['label'], fg=state_info['color'])
        e_rate.config(state="normal")
        if auto_fill:
            e_rate.delete(0, tk.END)
            if val == 3:
                e_rate.insert(0, self.entry_plat_rate.get().strip() or str(self.DEFAULT_CONFIG['platform_rate']))
            else:
            e_rate.insert(0, state_info['rate'])
        if val in (0, 3):
            e_rate.config(state="readonly")

    def add_rev_row(self, name="", amt="", rate="0.09", is_inclusive=True, stamp=True):
        """添加收入行"""
        row = ttk.Frame(self.rev_container)
        row.pack(fill="x", pady=4)
        
        ttk.Label(row, text="名称:").pack(side="left", padx=1)
        e_name = ttk.Entry(row, width=12)
        e_name.insert(0, name)
        e_name.pack(side="left", padx=2)
        
        ttk.Label(row, text="单价:").pack(side="left", padx=1)
        e_amt = ttk.Entry(row, width=9)
        e_amt.insert(0, amt)
        e_amt.pack(side="left", padx=2)
        
        ttk.Label(row, text="税率:").pack(side="left", padx=1)
        e_rate = ttk.Entry(row, width=6)
        e_rate.insert(0, rate if is_inclusive else "0")
        e_rate.pack(side="left", padx=2)
        
        v_inc = tk.BooleanVar(value=is_inclusive)
        v_stamp = tk.BooleanVar(value=stamp)
        btn_inc = tk.Button(
            row, text="✅ 含税金额" if is_inclusive else "⬜ 不含税金额",
                           fg="green" if is_inclusive else "gray", relief="flat", 
            cursor="hand2", font=("Microsoft YaHei", 9, "bold")
        )
        btn_inc.config(command=lambda: self.toggle_rev_btn(v_inc, btn_inc, e_rate))
        btn_inc.pack(side="left", padx=6)
        
        btn_del = ttk.Button(row, text="❌", width=3, command=lambda: self.delete_row(row, self.rev_items))
        btn_del.pack(side="left", padx=4)
        
        for e in (e_name, e_amt, e_rate):
            e.bind("<KeyRelease>", lambda event: self.calculate_cost())
            
        self.rev_items.append({
            'frame': row, 'name': e_name, 'amt': e_amt, 'rate': e_rate,
            'inc': v_inc, 'stamp': v_stamp
        })
        self.calculate_cost()

    def add_cost_row(self, name="", amt="", rate="", state=1, stamp=None):
        """添加成本行"""
        row = ttk.Frame(self.cost_container)
        row.pack(fill="x", pady=4)
        
        ttk.Label(row, text="名称:").pack(side="left", padx=1)
        e_name = ttk.Entry(row, width=12)
        e_name.insert(0, name)
        e_name.pack(side="left", padx=2)
        
        ttk.Label(row, text="单价:").pack(side="left", padx=1)
        e_amt = ttk.Entry(row, width=9)
        e_amt.insert(0, amt)
        e_amt.pack(side="left", padx=2)
        
        ttk.Label(row, text="税率:").pack(side="left", padx=1)
        e_rate = ttk.Entry(row, width=6)
        e_rate.pack(side="left", padx=2)
        
        v_state = tk.IntVar(value=state)
        if stamp is None:
            stamp = "居间" not in name
        v_stamp = tk.BooleanVar(value=stamp)
        btn_state = tk.Button(row, relief="flat", cursor="hand2", font=("Microsoft YaHei", 9, "bold"))
        lbl_dynamic = tk.Label(row, text="", fg="purple", font=("Microsoft YaHei", 9, "bold"), anchor="w")
        
        item_dict = {
            'frame': row, 'name': e_name, 'amt': e_amt, 'rate': e_rate, 
            'state': v_state, 'stamp': v_stamp, 'btn_state': btn_state, 'lbl_dynamic': lbl_dynamic
        }
        btn_state.config(command=lambda: self.toggle_cost_state(item_dict))
        btn_state.pack(side="left", padx=6)
        lbl_dynamic.pack(side="left", padx=2)
        
        btn_del = ttk.Button(row, text="❌", width=3, command=lambda: self.delete_row(row, self.cost_items))
        btn_del.pack(side="left", padx=8)
        
        if not rate:
            rate = self.COST_STATE_MAP.get(state, self.COST_STATE_MAP[1])['rate']
        e_rate.insert(0, rate)
        self.update_cost_visuals(item_dict, auto_fill=False)
        
        for e in (e_name, e_amt, e_rate):
            e.bind("<KeyRelease>", lambda event: self.calculate_cost())
            
        self.cost_items.append(item_dict)
        self.calculate_cost()

    def delete_row(self, frame, item_list):
        frame.destroy()
        item_list[:] = [item for item in item_list if item['frame'] != frame]
        self.calculate_cost()

    def get_float(self, entry, default=0.0):
        try:
            val = entry.get().strip()
            return float(val) if val else default
        except (ValueError, tk.TclError):
            return default

    def get_stamp_rate(self):
        return self.get_float(self.entry_stamp, self.DEFAULT_CONFIG['stamp_tax_rate'])

    def _upstream_rate(self):
        """没有单独销项税率框时，取第一项含税收入的税率"""
        for item in self.rev_items:
            if item['inc'].get():
                return self.get_float(item['rate'], self.DEFAULT_CONFIG['default_vat_rate'])
        return self.DEFAULT_CONFIG['default_vat_rate']

    def is_small(self):
        return self.taxpayer == 'small'

    def _vat_split(self, cash, rate):
        """按税率把价税合计拆成不含税金额和税额"""
        cash = self._d_round(cash)
        if rate > 0:
            excl = self._d_round(cash / (1 + rate))
            return {'excl': excl, 'vat': self._d_round(cash - excl)}
        return {'excl': cash, 'vat': 0.0}

    def _split_rev(self, r, qty, force=None):
        """拆分收入：开票按含税销售额倒挤；不开票税率须为 0，实收即营业收入"""
        inc = r['inc']
        rate = r['rate']
        amt = r['amt'] * qty
        if force:
            if force.get('inc') is not None:
                inc = force['inc']
            if force.get('rate') is not None:
                rate = force['rate']
            if force.get('cash') is not None:
                amt = force['cash']
        if inc:
                cash = self._d_round(amt)
            split = self._vat_split(cash, rate)
            return {'cash': cash, 'excl': split['excl'], 'out_vat': split['vat'], 'inc': inc, 'rate': rate}
                excl = self._d_round(amt)
                out_vat = self._d_round(excl * rate)
                cash = self._d_round(excl + out_vat)
        return {'cash': cash, 'excl': excl, 'out_vat': out_vat, 'inc': inc, 'rate': rate}

    def _split_cost(self, c, qty, p_rate, up_rate, small_mode):
        """拆分成本：代扣按净价还原后用销项税率拆进项；普票不得抵扣进项"""
        ticket = c['ticket']
        if ticket == 3:
            net = self._d_round(c['amt'] * qty)
            cash = self._d_round(net / (1 - p_rate)) if 0 < p_rate < 1 else net
            split = self._vat_split(cash, up_rate)
            raw = {
                'cash': cash, 'excl': split['excl'], 'in_vat': split['vat'],
                'cost_deduct': split['excl'], 'tax_deduct': split['excl'],
                'stamp_excl': split['excl']
            }
        else:
            cash = self._d_round(c['amt'] * qty)
            if ticket == 2:
                split = self._vat_split(cash, c['rate'])
                raw = {
                    'cash': cash, 'excl': split['excl'], 'in_vat': split['vat'],
                    'cost_deduct': split['excl'], 'tax_deduct': split['excl'],
                    'stamp_excl': split['excl']
                }
            elif ticket == 1:
                split = self._vat_split(cash, c['rate'])
                raw = {
                    'cash': cash, 'excl': split['excl'], 'in_vat': 0.0,
                    'cost_deduct': cash, 'tax_deduct': cash,
                    'stamp_excl': split['excl']
                }
            else:
                raw = {
                    'cash': cash, 'excl': cash, 'in_vat': 0.0,
                    'cost_deduct': cash, 'tax_deduct': 0.0,
                    'stamp_excl': cash
                }
        if small_mode:
            return {
                'cash': raw['cash'],
                'excl': raw['cash'],
                'in_vat': 0.0,
                'cost_deduct': raw['cash'],
                'tax_deduct': 0.0 if ticket == 0 else raw['cash'],
                'stamp_excl': raw['stamp_excl']
            }
        return raw

    def _collect_ui(self):
        """从左侧控件采集测算参数（左侧填小数税率，如 0.09）"""
        revs = []
        for item in self.rev_items:
            revs.append({
                'name': item['name'].get().strip() or "未命名收入",
                'amt': self.get_float(item['amt']),
                'rate': self.get_float(item['rate']),
                'inc': bool(item['inc'].get()),
                'stamp': bool(item['stamp'].get()) if item.get('stamp') else True
            })
        costs = []
        for item in self.cost_items:
            costs.append({
                'name': item['name'].get().strip() or "未命名成本",
                'amt': self.get_float(item['amt']),
                'rate': self.get_float(item['rate']),
                'ticket': item['state'].get(),
                'stamp': bool(item['stamp'].get()) if item.get('stamp') else True
            })
        return {
            'qty': self.get_float(self.entry_qty, self.DEFAULT_CONFIG['qty']),
            'p_rate': self.get_float(self.entry_plat_rate, self.DEFAULT_CONFIG['platform_rate']),
            'sur_rate': self.get_float(self.entry_surcharge, self.DEFAULT_CONFIG['surcharge_rate']),
            'inc_rate': self.get_float(self.entry_income_tax, self.DEFAULT_CONFIG['income_tax_rate']),
            'stamp_rate': self.get_stamp_rate(),
            'up_rate': self._upstream_rate(),
            'small': self.is_small(),
            'revs': revs,
            'costs': costs
        }

    def _calc_totals(self, cfg):
        """与 0.99 版 calcTotals 同一套内核"""
        qty = cfg['qty']
        p_rate = cfg['p_rate']
        sur_rate = cfg['sur_rate']
        inc_rate = cfg['inc_rate']
        stamp_rate = cfg['stamp_rate']
        up_rate = cfg.get('up_rate') or 0.0
        small = cfg.get('small', False)
        force_first = cfg.get('force_first')

        cash_rev = rev_excl = out_vat = 0.0
        cash_cost = cost_excl = tax_deduct = in_vat = stamp_base = 0.0
        rev_rows = []
        cost_rows = []

        for i, r in enumerate(cfg['revs']):
            s = self._split_rev(r, qty, force_first if (force_first and i == 0) else None)
            cash_rev += s['cash']
            rev_excl += s['excl']
            out_vat += s['out_vat']
            if r.get('stamp'):
                stamp_base += s['excl']
            row = dict(s)
            row['name'] = r.get('name', '')
            row['unit_amt'] = r.get('amt', 0)
            row['is_inc'] = s['inc']
            row['type_str'] = "开票（含税销售额）" if s['inc'] else "不开票（实收）"
            rev_rows.append(row)

        for c in cfg['costs']:
            s = self._split_cost(c, qty, p_rate, up_rate, small)
            cash_cost += s['cash']
            cost_excl += s['cost_deduct']
            tax_deduct += s['tax_deduct']
            in_vat += s['in_vat']
            if c.get('stamp'):
                stamp_base += s['stamp_excl']
            row = dict(s)
            row['name'] = c.get('name', '')
            row['unit_amt'] = c.get('amt', 0)
            row['state'] = c.get('ticket', 0)
            row['rate'] = up_rate if c.get('ticket') == 3 else c.get('rate', 0)
            row['p_rate'] = p_rate
            ticket = c.get('ticket', 0)
            if ticket == 3:
                row['type_str'] = f"代扣代缴（税点{p_rate * 100:g}%，按销项税率拆进项）"
            elif ticket == 2:
                row['type_str'] = "专票（可抵扣进项）"
            elif ticket == 1:
                row['type_str'] = "普票（全额计成本）"
            else:
                row['type_str'] = "无票（不得税前扣除）"
            if ticket == 3:
                row['desc'] = (
                    f"司机净价:{c['amt']:.2f} → 含税支出:{s['cash']:.2f} "
                    f"(净价/(1−税点)×{qty:g}) | 进项:{s['in_vat']:.2f} [{row['type_str']}]"
                )
            else:
                row['desc'] = f"单价:{c['amt']:.2f}×{qty:g}单 | 抵扣进项:{s['in_vat']:.2f} [{row['type_str']}]"
            cost_rows.append(row)

        cash_rev = self._d_round(cash_rev)
        rev_excl = self._d_round(rev_excl)
        out_vat = self._d_round(out_vat)
        cash_cost = self._d_round(cash_cost)
        cost_excl = self._d_round(cost_excl)
        tax_deduct = self._d_round(tax_deduct)
        in_vat = self._d_round(in_vat)
        stamp_base = self._d_round(stamp_base)

        pay_vat = self._d_round(max(0, out_vat - in_vat))
        unused_vat = self._d_round(max(0, in_vat - out_vat))
        if unused_vat > 0:
            tax_deduct = self._d_round(tax_deduct + unused_vat)
            cost_excl = self._d_round(cost_excl + unused_vat)

        sur = self._d_round(pay_vat * sur_rate)
        stamp = self._d_round(stamp_base * stamp_rate)
        taxable_inc = self._d_round(rev_excl - tax_deduct - sur - stamp)
        inc_tax = self._d_round(max(0, taxable_inc * inc_rate))
        total_tax = self._d_round(pay_vat + sur + stamp + inc_tax)
        tax_add = self._d_round(sur + stamp)
        other_tax = self._d_round(tax_add + inc_tax)
        cash_margin = self._d_round(cash_rev - cash_cost)
        net_profit = self._d_round(cash_margin - total_tax)
        profit_before_tax = self._d_round(rev_excl - cost_excl - tax_add)
        f2_profit = self._d_round(profit_before_tax - inc_tax)

        return {
            'cash_rev': cash_rev, 'rev_excl': rev_excl, 'out_vat': out_vat,
            'cash_cost': cash_cost, 'cost_excl': cost_excl, 'tax_deduct': tax_deduct, 'in_vat': in_vat,
            'stamp_base': stamp_base, 'unused_vat': unused_vat, 'pay_vat': pay_vat,
            'sur': sur, 'stamp': stamp, 'taxable_inc': taxable_inc, 'inc_tax': inc_tax,
            'tax_add': tax_add, 'profit_before_tax': profit_before_tax,
            'total_tax': total_tax, 'other_tax': other_tax,
            'cash_margin': cash_margin, 'net_profit': net_profit, 'f2_profit': f2_profit,
            'rev_rows': rev_rows, 'cost_rows': cost_rows
        }

    def _update_cost_labels(self, cfg, totals):
        """刷新成本行旁的进项/净成本提示"""
        qty = cfg['qty'] if cfg['qty'] else 1
        for item, row in zip(self.cost_items, totals['cost_rows']):
            lbl = item.get('lbl_dynamic')
            if not lbl:
                continue
            unit_cash = row['cash'] / qty
            unit_excl = row['excl'] / qty
            unit_vat = row['in_vat'] / qty
            unit_cost = row['cost_deduct'] / qty
            st = row['state']
            if st == 3:
                lbl.config(
                    text=f"含税支出: {unit_cash:.2f}  进项抵扣: {unit_vat:.2f}  净成本: {unit_excl:.2f}",
                fg="purple"
            )
            elif st == 2:
                lbl.config(text=f"进项抵扣: {unit_vat:.2f}  净成本: {unit_excl:.2f}", fg="green")
            elif st == 1:
                lbl.config(text=f"进项抵扣: 0.00  净成本: {unit_cost:.2f}", fg="#0078D7")
        else:
                lbl.config(text=f"无抵扣  净成本: {unit_cost:.2f} (不得税前扣除)", fg="red")

    def _get_breakeven_rev(self, cfg):
        """二分查找第一项收入的保本含税/实收金额"""
        up_rate = cfg['up_rate']
        if not cfg['revs']:
            return {'no_invoice': 0.0, 'with_invoice': 0.0, 'rate': up_rate}
        probe = self._calc_totals(cfg)
        rest_zero = all(r['amt'] == 0 for r in cfg['revs'][1:]) if len(cfg['revs']) > 1 else True
        if probe['cash_cost'] == 0 and rest_zero:
            return {'no_invoice': 0.0, 'with_invoice': 0.0, 'rate': up_rate}

        def trial(amount, invoice_rate):
            trial_cfg = dict(cfg)
            trial_cfg['force_first'] = {
                'cash': amount, 'inc': invoice_rate > 0, 'rate': invoice_rate
            }
            return self._calc_totals(trial_cfg)

        def find_min_rev(invoice_rate):
            low_cents = 0
            high_cents = max(100, math.ceil((probe['cash_cost'] + 1) * 400))
            t_high = trial(high_cents / 100.0, invoice_rate)
            while t_high['net_profit'] < 0 and high_cents < 1e12:
                high_cents *= 2
                t_high = trial(high_cents / 100.0, invoice_rate)
            if t_high['net_profit'] < 0:
                return high_cents / 100.0
            best_cents = high_cents
            while low_cents <= high_cents:
                mid_cents = (low_cents + high_cents) // 2
                if trial(mid_cents / 100.0, invoice_rate)['net_profit'] >= 0:
                    best_cents = mid_cents
                    high_cents = mid_cents - 1
            else:
                    low_cents = mid_cents + 1
            return best_cents / 100.0
        
        return {
            'no_invoice': find_min_rev(0),
            'with_invoice': find_min_rev(up_rate),
            'rate': up_rate
        }

    def show_breakeven(self):
        """保本测算：不开票应收 / 开票金额"""
        if not self.rev_items:
            messagebox.showwarning("保本测算", "请先添加一项收入，再进行保本测算")
            return
        cfg = self._collect_ui()
        res = self._get_breakeven_rev(cfg)
        qty = cfg['qty']
        rate = res['rate']
        inv_excl = self._d_round(res['with_invoice'] / (1 + rate)) if rate > 0 else res['with_invoice']
        t_no = self._calc_totals(dict(cfg, force_first={
            'cash': res['no_invoice'], 'inc': False, 'rate': 0
        }))
        t_inv = self._calc_totals(dict(cfg, force_first={
            'cash': res['with_invoice'], 'inc': True, 'rate': rate
        }))
        rate_label = "征收率" if self.is_small() else "销项税率"
        rate_pct = f"{rate * 100:.2f}".rstrip('0').rstrip('.')
        lines = [
            f"不开票应收金额  {res['no_invoice']:.2f} 元",
            f"此时现金净流量 {t_no['net_profit']:.2f} 元；再低 0.01 元则现金净流量为负",
            "",
            f"开票金额  {res['with_invoice']:.2f} 元",
            f"营业收入 {inv_excl:.2f} 元",
            f"＝ 含税销售额 ÷（1＋{rate_label} {rate_pct}%）",
            f"此时现金净流量 {t_inv['net_profit']:.2f} 元；再低 0.01 元则现金净流量为负",
        ]
        if qty > 0 and qty != 1:
            lines.append("")
            lines.append(
                f"以上为 {qty:g} 倍合计 · 单价不开票 {self._d_round(res['no_invoice'] / qty):.2f} / "
                f"开票金额 {self._d_round(res['with_invoice'] / qty):.2f}"
            )
        elif qty == 0:
            lines.append("")
            lines.append("业务数量为 0，不测算单价")
        if len(cfg['revs']) > 1:
            lines.append("")
            lines.append(f"按第一项收入测算保本，其余 {len(cfg['revs']) - 1} 项收入已计入")
        messagebox.showinfo("保本测算", "\n".join(lines))

    def calculate_cost(self):
        """核心核算：与 0.99 版同一套 calcTotals 内核"""
        if not hasattr(self, 'tree'):
            return
        for item in self.tree.get_children():
            self.tree.delete(item)

        try:
            cfg = self._collect_ui()
            t = self._calc_totals(cfg)
            self._update_cost_labels(cfg, t)
            qty = cfg['qty']
            cost_excl_parts = [f"{row['name']} {row['cost_deduct']:.2f}" for row in t['cost_rows']]
            if t['unused_vat'] > 0:
                cost_excl_parts.append(f"未抵扣进项 {t['unused_vat']:.2f}")

            self.report_data = {
                'qty': qty,
                'sys_surcharge_rate': cfg['sur_rate'],
                'sys_income_rate': cfg['inc_rate'],
                'sys_stamp_rate': cfg['stamp_rate'],
                'plat_rate': cfg['p_rate'],
                'up_rate': cfg['up_rate'],
                'v_use_platform': self.v_use_platform.get(),
                'taxpayer': self.taxpayer,
                'revs': t['rev_rows'],
                'costs': t['cost_rows'],
                'total_cash_rev': t['cash_rev'],
                'total_rev_excl': t['rev_excl'],
                'total_output_vat': t['out_vat'],
                'total_cash_cost': t['cash_cost'],
                'total_cost_excl': t['cost_excl'],
                'total_taxable_cost_deduct': t['tax_deduct'],
                'total_input_vat': t['in_vat'],
                'payable_vat': t['pay_vat'],
                'surcharge': t['sur'],
                'stamp_duty': t['stamp'],
                'income_tax': t['inc_tax'],
                'total_tax': t['total_tax'],
                'total_other_tax': t['other_tax'],
                'taxable_income': t['taxable_inc'],
                'cash_margin': t['cash_margin'],
                'net_profit': t['net_profit'],
                'f2_profit': t['f2_profit'],
                'stamp_base': t['stamp_base'],
                'unused_vat': t['unused_vat'],
                'tax_add': t['tax_add'],
                'profit_before_tax': t['profit_before_tax'],
                'cost_excl_details_str': " + ".join(cost_excl_parts) if cost_excl_parts else str(t['cost_excl'])
            }
            self._display_results(cfg, t)
            self._update_scroll_region()
        except Exception as e:
            self.tree.insert('', 'end', values=("计算出错", "", "", f"错误详情: {str(e)}"))
            traceback.print_exc()

    def _display_results(self, cfg, t):
        """右侧结果：利润表拆税金及附加 / 所得税费用，现金侧按当期实缴"""
        qty = cfg['qty']
        sur_pct = self.get_float(self.entry_surcharge, 6)
        inc_pct = self.get_float(self.entry_income_tax, 5)
        stamp_pm = self.get_float(self.entry_stamp, 1.5)
        rate_label = "征收率" if cfg['small'] else "销项税率"

        self.tree.insert('', 'end', values=(f"【营业收入明细】 (共 {qty:g} 单)", "", "", ""), tags=('header',))
        for row in t['rev_rows']:
            desc = f"单价:{row['unit_amt']:.2f}×{qty:g}单 | 销项税额:{row['out_vat']:.2f} [{row['type_str']}]"
            self.tree.insert('', 'end', values=(f" + {row['name']}", f"{row['cash']:.2f}", f"{row['excl']:.2f}", desc))

        self.tree.insert('', 'end', values=(f"【营业成本明细】 (共 {qty:g} 单)", "", "", ""), tags=('header',))
        for row in t['cost_rows']:
        self.tree.insert('', 'end', values=(
                f" - {row['name']}", f"{row['cash']:.2f}", f"{row['cost_deduct']:.2f}", row['desc']
        ))
        if t['unused_vat'] > 0:
        self.tree.insert('', 'end', values=(
                " - 未抵扣进项税额", "", f"{t['unused_vat']:.2f}",
                f"进项税额 {t['in_vat']:.2f} − 销项税额 {t['out_vat']:.2f}，本单未抵完部分计入营业成本"
            ))

        self.tree.insert('', 'end', values=("-" * 25, "-" * 15, "-" * 15, "-" * 55), tags=('separator',))
        self.tree.insert('', 'end', values=("【法定税费】", "", "", "增值税不进利润表；附加税费+印花=税金及附加"), tags=('header',))
        self.tree.insert('', 'end', values=(
            "应交增值税", f"- {t['pay_vat']:.2f}", "",
            f"销项税额 {t['out_vat']:.2f} − 进项税额 {t['in_vat']:.2f} = {t['pay_vat']:.2f}"
        ))
        self.tree.insert('', 'end', values=(
            f"附加税费 ({sur_pct:g}%)", f"- {t['sur']:.2f}", "",
            f"应交增值税 {t['pay_vat']:.2f} × {sur_pct:g}% = {t['sur']:.2f}"
        ))
        self.tree.insert('', 'end', values=(
            f"印花税 ({stamp_pm:g}‱)", f"- {t['stamp']:.2f}", "",
            f"分项合同基数 {t['stamp_base']:.2f} × {stamp_pm:g}‱ = {t['stamp']:.2f}（免印花项不计入）"
        ))
        self.tree.insert('', 'end', values=(
            "税金及附加", f"- {t['tax_add']:.2f}", "",
            f"附加税费 {t['sur']:.2f} + 印花税 {t['stamp']:.2f} = {t['tax_add']:.2f}"
        ))
        self.tree.insert('', 'end', values=(
            f"所得税费用 ({inc_pct:g}%)", f"- {t['inc_tax']:.2f}", "",
            f"应纳税所得额 {max(0, t['taxable_inc']):.2f} = 营业收入 {t['rev_excl']:.2f} − "
            f"税前扣除 {t['tax_deduct']:.2f} − 税金及附加 {t['tax_add']:.2f}，× {inc_pct:g}%"
        ))

        self.tree.insert('', 'end', values=("=" * 25, "=" * 15, "=" * 15, "=" * 55), tags=('separator',))
        self.tree.insert('', 'end', values=("【利润表】", "", "", "权责发生制 · 增值税不列示"), tags=('header',))
        self.tree.insert('', 'end', values=(
            "营业收入", "", f"{t['rev_excl']:.2f}",
            f"含税销售额 ÷（1＋{rate_label}）；不开票时等于实收"
        ))
        self.tree.insert('', 'end', values=("营业成本", "", f"{t['cost_excl']:.2f}", "专票按不含税；普票/无票按含税支出；未抵扣进项计入成本"))
        self.tree.insert('', 'end', values=("税金及附加", "", f"{t['tax_add']:.2f}", "附加税费 + 印花税"))
        self.tree.insert('', 'end', values=(
            "利润总额", "", f"{t['profit_before_tax']:.2f}",
            f"{t['rev_excl']:.2f} − {t['cost_excl']:.2f} − {t['tax_add']:.2f}"
        ))
        self.tree.insert('', 'end', values=("所得税费用", "", f"{t['inc_tax']:.2f}", "不计入税金及附加"))
        net = t['f2_profit']
        self.tree.insert('', 'end', values=(
            "净利润", "", f"{'+' if net >= 0 else ''}{net:.2f}",
            f"利润总额 {t['profit_before_tax']:.2f} − 所得税费用 {t['inc_tax']:.2f}"
        ), tags=('success' if net >= 0 else 'highlight',))

        self.tree.insert('', 'end', values=("-" * 25, "-" * 15, "-" * 15, "-" * 55), tags=('separator',))
        self.tree.insert('', 'end', values=("【现金收付】", "", "", "假设本期计提的税费均于当期缴纳"), tags=('header',))
        self.tree.insert('', 'end', values=("含税收入", f"{t['cash_rev']:.2f}", "", "开票为含税销售额，不开票为实收"))
        self.tree.insert('', 'end', values=("含税支出", f"{t['cash_cost']:.2f}", "", "开票为含税支出，代扣为净价还原后的含税支出"))
        self.tree.insert('', 'end', values=("实缴增值税", f"- {t['pay_vat']:.2f}", "", "等于应交增值税"))
        self.tree.insert('', 'end', values=("实缴税金及附加", f"- {t['tax_add']:.2f}", "", "附加税费 + 印花税"))
        self.tree.insert('', 'end', values=("实缴所得税", f"- {t['inc_tax']:.2f}", "", "等于所得税费用"))
        self.tree.insert('', 'end', values=(
            "含税收支净额", f"{t['cash_margin']:.2f}", "",
            f"含税收入 {t['cash_rev']:.2f} − 含税支出 {t['cash_cost']:.2f}"
        ))
        cash_net = t['net_profit']
        self.tree.insert('', 'end', values=(
            "现金净流量", f"{'+' if cash_net >= 0 else ''}{cash_net:.2f}", "",
            f"含税收支净额 − 实缴增值税 − 实缴税金及附加 − 实缴所得税；应与净利润一致"
        ), tags=('success' if cash_net >= 0 else 'highlight',))

    def _update_scroll_region(self):
        """更新滚动区域"""
        self.root.update_idletasks()
        c_w = self.canvas.winfo_width()
        r_w = self.scrollable_frame.winfo_reqwidth()
        self.canvas.itemconfig(self.canvas_window, width=max(c_w, r_w))
        self.canvas.configure(scrollregion=self.canvas.bbox("all"))

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
        """生成完整 0.99 页：左侧设置/填写区 + 右侧核算报表"""
            self.calculate_cost()
        cfg = self._collect_ui()
        template = self._load_099_template()
        if template:
            page = self._inject_099_snapshot(template, cfg)
        else:
            totals = self._calc_totals(cfg)
            page = self._build_full_099_page(cfg, totals)
        file_path = os.path.abspath("cost_report.html")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(page)
        webbrowser.open("file://" + file_path)

    def _load_099_template(self):
        here = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(here, "多维物流成本核算0.99版.html")
        if not os.path.isfile(path):
            return ""
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def _snapshot_payload(self, cfg):
        revs = []
        for i, r in enumerate(cfg["revs"], 1):
            revs.append({
                "id": i,
                "name": r["name"],
                "amt": r["amt"],
                "rate": r["rate"],
                "inc": bool(r["inc"]),
                "stamp": bool(r.get("stamp", True)),
            })
        costs = []
        for i, c in enumerate(cfg["costs"], 1):
            costs.append({
                "id": i,
                "name": c["name"],
                "amt": c["amt"],
                "rate": c["rate"],
                "ticket": int(c["ticket"]),
                "stamp": bool(c.get("stamp", True)),
            })
        return {
            "usePlatform": bool(self.v_use_platform.get()),
            "taxpayer": self.taxpayer,
            "revs": revs,
            "costs": costs,
            "nextId": max(10, len(revs) + len(costs) + 1) + 20,
            "surchargePct": round(cfg["sur_rate"] * 100, 4),
            "incomePct": round(cfg["inc_rate"] * 100, 4),
            "stampPermyriad": round(cfg["stamp_rate"] * 10000, 4),
            "upstreamPct": round(cfg["up_rate"] * 100, 4),
            "qty": cfg["qty"],
            "platPct": round(cfg["p_rate"] * 100, 4),
        }

    def _inject_099_snapshot(self, template, cfg):
        """把当前填写写进 0.99 完整页（含左侧设置/输入区）"""
        payload = json.dumps(self._snapshot_payload(cfg), ensure_ascii=False)
        boot = """    applyPolicyDefaults();
    applyTaxpayerUi();
    buildForms();
    render();"""
        injected = (
            "    applyPolicyDefaults();\n"
            "    (function () {\n"
            f"        var d = {payload};\n"
            "        state.usePlatform = !!d.usePlatform;\n"
            "        state.taxpayer = d.taxpayer || 'general';\n"
            "        state.revs = d.revs || [];\n"
            "        state.costs = d.costs || [];\n"
            "        state.nextId = d.nextId || 100;\n"
            "        function setv(id, v) { var el = document.getElementById(id); if (el) el.value = v; }\n"
            "        setv('surchargeRate', d.surchargePct);\n"
            "        setv('incomeRate', d.incomePct);\n"
            "        setv('stampRate', d.stampPermyriad);\n"
            "        setv('upstreamRate', d.upstreamPct);\n"
            "        setv('qty', d.qty);\n"
            "        setv('platRate', d.platPct);\n"
            "        applyTaxpayerUi();\n"
            "        var btn = document.getElementById('btnPlatform');\n"
            "        var wrap = document.getElementById('wrapPlatRate');\n"
            "        if (state.usePlatform) {\n"
            "            if (btn) { btn.className = 'btn-toggle btn-purple'; btn.innerHTML = '已开启 代扣代缴'; }\n"
            "            if (wrap) wrap.style.display = 'flex';\n"
            "        }\n"
            "        buildForms();\n"
            "        render();\n"
            "    })();"
        )
        if boot in template:
            return template.replace(boot, injected, 1)
        return template.replace("</script>\n</body>", injected + "\n</script>\n</body>", 1)

    def _build_full_099_page(self, cfg, totals):
        """找不到 0.99 源文件时：自制左右分栏，左侧仍显示设置和填写"""
        body = (
            self._build_099_sidebar_html(cfg)
            + '<div class="report-view">'
            + self._build_099_report_body(cfg, totals)
            + "</div>"
        )
        taxpayer = "小规模纳税人" if cfg["small"] else "一般纳税人"
        return (
            "<!DOCTYPE html><html lang=\"zh-CN\"><head>"
            "<meta charset=\"UTF-8\">"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">"
            f"<title>单笔业务成本核算 0.99版 · {taxpayer}</title><style>"
            + self._099_full_layout_css()
            + self._099_report_css()
            + "</style></head><body><div class=\"app-container\">"
            + body
            + "</div>"
            + self._099_tip_script()
            + "</body></html>"
        )

    def _099_full_layout_css(self):
        return """
body.full-app, body { height: 100vh; overflow: hidden; padding: 0 !important; }
.app-container { display: grid; grid-template-columns: 38fr 62fr; gap: 20px; padding: 20px; width: 100%; height: 100%; min-width: 0; }
.sidebar { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06); display: flex; flex-direction: column; height: 100%; overflow-y: auto; overflow-x: hidden; padding: 24px 26px 28px; min-width: 0; }
.sidebar h1 { font-size: 20px; font-weight: 600; color: var(--text); margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
.form-group { border: 1px solid var(--line); border-radius: 14px; padding: 14px; margin-bottom: 14px; background: var(--surface-soft); }
.form-group-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.title-params { color: #1d4ed8; } .title-rev { color: #047857; } .title-cost { color: #b91c1c; }
.taxpayer-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.policy-note { margin-top: 10px; font-size: 11px; line-height: 1.65; color: #94a3b8; }
.grid-settings { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 12px; row-gap: 10px; align-items: center; }
.gs-item { display: grid; grid-template-columns: 7em max-content; align-items: center; column-gap: 8px; min-width: 0; }
.gs-label { font-size: 12px; color: var(--text); font-weight: 600; }
.gs-ctl { display: flex; align-items: center; gap: 4px; }
.gs-ctl .val { width: 72px; padding: 6px 8px; border: 1px solid var(--line-strong); border-radius: 8px; font-size: 14px; text-align: center; font-weight: 700; background: var(--surface); }
.list-head { display: flex; align-items: center; gap: 6px; padding: 0 8px 6px; font-size: 12px; color: var(--text-3); font-weight: 600; }
.list-row { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; background: var(--surface); padding: 8px; border-radius: 10px; border: 1px solid var(--line); flex-wrap: wrap; }
.list-row .nm { width: 100px; padding: 6px; border: 1px solid var(--line-strong); border-radius: 6px; }
.list-row .num { width: 64px; padding: 6px; border: 1px solid var(--line-strong); border-radius: 6px; text-align: center; }
.btn-toggle { padding: 6px 8px; border-radius: 8px; border: 1px solid transparent; font-size: 12px; font-weight: 600; }
.btn-gray { background: #f3f4f6; color: var(--text-2); border-color: var(--line); }
.btn-green { background: var(--ok-soft); color: var(--ok); border-color: #a7f3d0; }
.btn-blue { background: var(--brand-soft); color: var(--brand); border-color: #bfdbfe; }
.btn-red { background: var(--danger-soft); color: var(--danger); border-color: #fecaca; }
.btn-purple { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
.btn-stamp { background: var(--warn-soft); color: var(--warn); border-color: #fde68a; }
.pct-mark { font-size: 13px; font-weight: 600; color: var(--text-3); min-width: 16px; }
.highlight-linked { background-color: var(--ok-soft) !important; border-color: #a7f3d0 !important; color: #047857 !important; }
.report-view { min-width: 0; height: 100%; overflow: auto; }
.report-view .card { height: auto; max-width: none; }
@media (max-width: 900px) {
    body { height: auto; overflow: auto; }
    .app-container { display: flex; flex-direction: column; height: auto; }
    .sidebar { height: auto; overflow: visible; }
}
"""

    def _build_099_sidebar_html(self, cfg):
        """0.99 左侧：测算参数 + 营业收入 + 营业成本（快照）"""
        taxpayer = "小规模纳税人" if cfg["small"] else "一般纳税人"
        rate_label = "征收率" if cfg["small"] else "销项税率"
        plat_on = bool(self.v_use_platform.get())
        plat_cls = "btn-toggle btn-purple" if plat_on else "btn-toggle btn-gray"
        plat_txt = "已开启 代扣代缴" if plat_on else "已关闭 代扣代缴"
        gen_cls = "btn-toggle btn-blue" if not cfg["small"] else "btn-toggle btn-gray"
        sm_cls = "btn-toggle btn-blue" if cfg["small"] else "btn-toggle btn-gray"
        plat_style = "display:flex;" if plat_on else "display:none;"
        policy = ""
        if hasattr(self, "lbl_policy"):
            policy = self.lbl_policy.cget("text")

        def field(label, val, suffix, tone):
            return (
                f'<div class="gs-item"><span class="gs-label">{label}</span>'
                f'<div class="gs-ctl"><span class="val {tone}">{val}</span>'
                f'<span class="pct-mark">{suffix}</span></div></div>'
            )

        rev_rows = []
        for r in cfg["revs"]:
            inc_cls = "btn-toggle btn-green" if r["inc"] else "btn-toggle btn-gray"
            inc_txt = "开票" if r["inc"] else "不开票"
            stp_cls = "btn-toggle btn-stamp" if r.get("stamp") else "btn-toggle btn-gray"
            stp_txt = "印花" if r.get("stamp") else "免印花"
            pct = f"{(r['rate'] * 100):g}"
            rev_rows.append(
                f'<div class="list-row"><span class="nm">{self._esc(r["name"])}</span>'
                f'<span class="num">{r["amt"]:g}</span><span class="num">{pct}</span>'
                f'<span class="pct-mark">%</span><span class="{inc_cls}">{inc_txt}</span>'
                f'<span class="{stp_cls}">{stp_txt}</span></div>'
            )
        cost_rows = []
        ticket_map = {
            0: ("btn-toggle btn-red", "无票"),
            1: ("btn-toggle btn-blue", "普票"),
            2: ("btn-toggle btn-green", "专票"),
            3: ("btn-toggle btn-purple", "代扣"),
        }
        for c in cfg["costs"]:
            tcls, ttxt = ticket_map.get(c["ticket"], ticket_map[0])
            stp_cls = "btn-toggle btn-stamp" if c.get("stamp") else "btn-toggle btn-gray"
            stp_txt = "印花" if c.get("stamp") else "免印花"
            pct = f"{(c['rate'] * 100):g}"
            cost_rows.append(
                f'<div class="list-row"><span class="nm">{self._esc(c["name"])}</span>'
                f'<span class="num">{c["amt"]:g}</span><span class="num">{pct}</span>'
                f'<span class="pct-mark">%</span><span class="{tcls}">{ttxt}</span>'
                f'<span class="{stp_cls}">{stp_txt}</span></div>'
            )

        sur = round(cfg["sur_rate"] * 100, 4)
        inc = round(cfg["inc_rate"] * 100, 4)
        stamp = round(cfg["stamp_rate"] * 10000, 4)
        up = round(cfg["up_rate"] * 100, 4)
        qty = cfg["qty"]
        plat = round(cfg["p_rate"] * 100, 4)
        return f"""
<div class="sidebar">
    <h1>⚙️ 单笔业务成本核算 · {taxpayer}</h1>
    <div class="form-group">
        <div class="form-group-title title-params">
            <span>🎛 测算参数</span>
            <span class="{plat_cls}">{plat_txt}</span>
                </div>
        <div class="taxpayer-bar">
            <span class="gs-label">纳税身份</span>
            <span class="{gen_cls}">一般纳税人</span>
            <span class="{sm_cls}">小规模纳税人</span>
        </div>
        <div class="grid-settings">
            {field("附加税费", f"{sur:g}", "%", "tone-sur")}
            {field("企业所得税率", f"{inc:g}", "%", "tone-inc")}
            {field("印花税率", f"{stamp:g}", "‱", "tone-stamp")}
            {field(rate_label, f"{up:g}", "%", "highlight-linked")}
            {field("业务数量", f"{qty:g}", "", "tone-qty")}
            <div class="gs-item" style="{plat_style}">
                <span class="gs-label">代扣税率</span>
                <div class="gs-ctl"><span class="val highlight-linked">{plat:g}</span><span class="pct-mark">%</span></div>
            </div>
        </div>
        <div class="policy-note">{self._esc(policy)}</div>
    </div>
    <div class="form-group">
        <div class="form-group-title title-rev"><span>💰 营业收入</span></div>
        <div class="list-head"><span style="width:100px">项目</span><span style="width:64px;text-align:center">单价</span><span style="width:86px;text-align:center">税率</span></div>
        {''.join(rev_rows)}
    </div>
    <div class="form-group">
        <div class="form-group-title title-cost"><span>💸 营业成本</span></div>
        <div class="list-head"><span style="width:100px">项目</span><span style="width:64px;text-align:center">单价</span><span style="width:86px;text-align:center">税率</span></div>
        {''.join(cost_rows)}
    </div>
</div>
"""


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



if __name__ == "__main__":
    root = tk.Tk()
    app = LogisticsCalculator(root)
    root.mainloop()