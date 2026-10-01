import tkinter as tk
import importlib.util
from pathlib import Path
import webbrowser

webbrowser.open = lambda *a, **k: None

spec = importlib.util.spec_from_file_location("c36", r"e:\shipment-data-view\36.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
root = tk.Tk()
root.withdraw()
app = m.LogisticsCalculator(root)
app.generate_html_report()
html = Path(r"e:\shipment-data-view\cost_report.html").read_text(encoding="utf-8")
need = [
    'class="sidebar"',
    "🎛 测算参数",
    "💰 营业收入",
    "💸 营业成本",
    'id="reportView"',
    "主营业务收入",
    "外包运费",
    "居间服务",
    "var d = ",
    "applyTaxpayerUi",
]
missing = [s for s in need if s not in html]
print("len", len(html))
print("missing", missing)
print("has inject", "var d =" in html)
root.destroy()
