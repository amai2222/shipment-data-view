import tkinter as tk
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("c36", r"e:\shipment-data-view\36.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

root = tk.Tk()
root.withdraw()
app = m.LogisticsCalculator(root)
cfg = app._collect_ui()
t = app._calc_totals(cfg)
body = app._build_099_report_body(cfg, t)
page = (
    "<!DOCTYPE html><html lang='zh-CN'><head><meta charset='UTF-8'>"
    "<title>check</title><style>" + app._099_report_css() + "</style></head><body>"
    + body + "</body></html>"
)
out = Path(r"e:\shipment-data-view\cost_report.html")
out.write_text(page, encoding="utf-8")
need = [
    "利润表项目 · 只计算一次",
    "税费项目 · 引用上方结果",
    "💰 现金收付",
    "🧾 利润表",
    "tax-chip base",
    "营业收入",
    "营业成本",
    "应交增值税",
    "现金净流量",
    "交叉验证",
    "增值税税负",
    "实际税负",
    "含税口径",
    "不含税口径",
]
missing = [s for s in need if s not in page]
print("net", t["net_profit"], "f2", t["f2_profit"])
print("missing", missing)
print("bytes", out.stat().st_size)
root.destroy()
