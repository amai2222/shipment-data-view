import tkinter as tk
import importlib.util

spec = importlib.util.spec_from_file_location("c36", r"e:\shipment-data-view\36.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
root = tk.Tk()
root.withdraw()
app = m.LogisticsCalculator(root)
cfg = app._collect_ui()
print("title", app.root.title())
print("qty", cfg["qty"])
print("sur", cfg["sur_rate"], "inc", cfg["inc_rate"], "stamp", cfg["stamp_rate"])
print("up", cfg["up_rate"], "plat", cfg["p_rate"])
print("revs", [(r["name"], r["amt"], r["rate"], r["inc"]) for r in cfg["revs"]])
print("costs", [(c["name"], c["amt"], c["rate"], c["ticket"], c["stamp"]) for c in cfg["costs"]])
t = app._calc_totals(cfg)
print("net", t["net_profit"], "cash", t["cash_margin"])
print("cost labels:")
for item in app.cost_items:
    print(" ", item["name"].get(), item["lbl_dynamic"].cget("text"))
print("platform btn", app.btn_platform.cget("text"))
print("ok")
root.destroy()
