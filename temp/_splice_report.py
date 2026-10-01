from pathlib import Path

src_path = Path(r"e:\shipment-data-view\36.py")
inj_path = Path(r"e:\shipment-data-view\temp\_inject_report.py")
src = src_path.read_text(encoding="utf-8")
ns = {}
exec(inj_path.read_text(encoding="utf-8"), ns)
methods = ns["REPORT_METHODS"]
if methods.startswith("\n"):
    methods = methods[1:]
start = src.find("    def generate_html_report(self):")
end = src.find('\nif __name__ == "__main__":')
if start < 0 or end < 0:
    raise SystemExit(f"markers not found start={start} end={end}")
new = src[:start] + methods.rstrip() + "\n\n\n" + src[end:]
src_path.write_text(new, encoding="utf-8")
print("spliced", start, "->", end, "newlen", len(new))
