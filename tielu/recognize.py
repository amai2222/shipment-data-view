# 铁路大票 PDF / 图片 批量识别
# 用法：python recognize.py --input inbox --output output
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

from parser import CARGO_COLUMNS, EXCEL_COLUMNS, TARP_COLUMNS, parse_ticket_text, row_for_excel
from pdf_reader import IMAGE_EXT, extract_file

SUPPORTED = {".pdf"} | IMAGE_EXT


def collect_files(input_dir: Path) -> list[Path]:
    files = []
    for p in sorted(input_dir.rglob("*")):
        if p.is_file() and p.suffix.lower() in SUPPORTED:
            files.append(p)
    return files


def _rel_name(fpath: Path, base: Path | None):
    if base:
        try:
            return str(fpath.resolve().relative_to(base.resolve()))
        except ValueError:
            pass
    return fpath.name


def run_batch(
    files: list[Path],
    output_dir: Path,
    dpi: int,
    force_ocr: bool,
    save_raw: bool,
    input_base: Path | None = None,
):
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    json_dir = output_dir / "json"
    json_dir.mkdir(exist_ok=True)
    raw_dir = output_dir / "raw_text"
    if save_raw:
        raw_dir.mkdir(exist_ok=True)

    if not files:
        print("未找到 PDF 或图片。")
        return 1

    rows = []
    cargo_rows = []
    tarp_rows = []
    errors = []
    print(f"共 {len(files)} 个文件，开始识别…")

    for idx, fpath in enumerate(files, start=1):
        rel = _rel_name(fpath, input_base)
        print(f"[{idx}/{len(files)}] {rel}")
        try:
            pages = extract_file(fpath, dpi=dpi, force_ocr=force_ocr)
            file_payload = {"file": str(rel).replace("\\", "/"), "pages": []}
            for page in pages:
                parsed = parse_ticket_text(page["text"])
                rows.append(row_for_excel(str(rel), page["page_no"], page["method"], parsed))
                f = parsed.get("fields") or {}
                for item in parsed.get("cargo_items") or []:
                    cargo_rows.append(
                        {
                            "文件名": str(rel),
                            "页码": page["page_no"],
                            "运单号": f.get("ticket_no", ""),
                            "需求号": f.get("demand_no", ""),
                            "发站": f.get("from_station", ""),
                            "到站": f.get("to_station", ""),
                            "货物名称": item.get("cargo_name", ""),
                            "件数": item.get("pieces", ""),
                            "重量kg": item.get("weight", ""),
                            "箱型箱类": item.get("box_type", ""),
                            "箱号": item.get("box_no", ""),
                            "承运人确定重量kg": item.get("confirmed_weight", ""),
                            "运价号": item.get("rate_no", ""),
                        }
                    )
                for tno in parsed.get("tarpaulin_list") or []:
                    if not tno:
                        continue
                    tarp_rows.append(
                        {
                            "文件名": str(rel),
                            "页码": page["page_no"],
                            "运单号": f.get("ticket_no", ""),
                            "篷布号": tno,
                            "来源": "运单记事或栏位",
                        }
                    )
                file_payload["pages"].append(
                    {
                        "page": page["page_no"],
                        "method": page["method"],
                        "doc_type": parsed["doc_type"],
                        "fields": parsed["fields"],
                        "cargo_items": parsed.get("cargo_items") or [],
                        "tarpaulin_list": parsed.get("tarpaulin_list") or [],
                        "confidence_note": parsed["confidence_note"],
                    }
                )
                if save_raw:
                    raw_name = f"{str(rel).replace('/', '_').replace(chr(92), '_')}__p{page['page_no']}.txt"
                    (raw_dir / raw_name).write_text(parsed["raw_text"], encoding="utf-8")
            safe = str(rel).replace("\\", "_").replace("/", "_")
            (json_dir / f"{safe}.json").write_text(
                json.dumps(file_payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            msg = f"{rel}: {exc}"
            print(f"  失败：{msg}")
            errors.append(msg)
            fail = {col: "" for col in EXCEL_COLUMNS}
            fail["文件名"] = str(rel)
            fail["识别方式"] = "失败"
            fail["置信说明"] = str(exc)
            rows.append(fail)

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    xlsx_path = output_dir / f"铁路大票识别结果_{stamp}.xlsx"
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        pd.DataFrame(rows, columns=EXCEL_COLUMNS).to_excel(writer, sheet_name="运单汇总", index=False)
        pd.DataFrame(cargo_rows, columns=CARGO_COLUMNS).to_excel(
            writer, sheet_name="集装箱明细", index=False
        )
        pd.DataFrame(tarp_rows, columns=TARP_COLUMNS).to_excel(
            writer, sheet_name="篷布明细", index=False
        )

    print("")
    print(f"完成。结果表：{xlsx_path}")
    print(f"JSON：{json_dir}")
    if errors:
        print(f"失败 {len(errors)} 个，见 Excel「置信说明」列。")
    return 0 if not errors else 2


def main(argv=None):
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="铁路大票 PDF/图片 批量识别，导出 Excel")
    parser.add_argument(
        "-i",
        "--input",
        default=str(here / "inbox"),
        help="待识别目录（默认 tielu/inbox）",
    )
    parser.add_argument("-f", "--file", help="单个 PDF/图片路径")
    parser.add_argument(
        "-o",
        "--output",
        default=str(here / "output"),
        help="结果输出目录（默认 tielu/output）",
    )
    parser.add_argument("--dpi", type=int, default=220, help="扫描件渲染清晰度，默认 220")
    parser.add_argument("--force-ocr", action="store_true", help="即使 PDF 已有文字层也强制 OCR")
    parser.add_argument("--save-raw", action="store_true", help="同时保存每页识别原文 txt")
    args = parser.parse_args(argv)

    if args.file:
        fpath = Path(args.file)
        if not fpath.exists():
            print(f"文件不存在：{fpath}")
            return 1
        files = [fpath]
        base = fpath.parent
    else:
        input_dir = Path(args.input)
        if not input_dir.exists():
            input_dir.mkdir(parents=True, exist_ok=True)
            print(f"已创建输入目录：{input_dir}")
            print("请把铁路大票 PDF 或图片放进去后重新运行。")
            return 0
        files = collect_files(input_dir)
        base = input_dir

    return run_batch(files, Path(args.output), args.dpi, args.force_ocr, args.save_raw, base)


if __name__ == "__main__":
    sys.exit(main())
