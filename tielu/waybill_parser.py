# 中国铁路「货物运单」版式解析（标签与值分行）
import re

_BOX_NO = re.compile(r"\b([A-Z]{4}\d{6,7})\b")
_WAYBILL_NO = re.compile(r"^[A-Z]{4,10}\d{5,14}$")
_DEMAND_NO = re.compile(r"需求号[:：]\s*(\d+)")
# 记事中常见自备篷布编号，如 ZD22060102、ZE220102212
_TARP_NO = re.compile(r"\b(Z[DE]\d{6,12})\b", re.I)
_MONEY = re.compile(r"[\d,.]+")

_HEADER_SKIP = {
    "货物名称",
    "件数",
    "包装",
    "货物价格",
    "(元)",
    "重量(kg)",
    "箱型箱类",
    "箱号",
    "集装箱",
    "施封号",
    "承运人确定",
    "体积",
    "(m³)",
    "(m³) 运价号计费重量",
    "(kg)",
    "运价号计费重量",
}

_NOISE_VAL = {
    "专用线",
    "货区",
    "货位",
    "集装箱",
    "经办人",
    "手机号码",
    "名称",
    "车种车号",
    "取货地址",
    "联系电话",
    "取货里程(km)",
    "送货地址",
    "送货里程(km)",
    "篷布号",
    "标重",
}


def _lines(text):
    out = []
    for line in (text or "").replace("\r", "\n").split("\n"):
        line = re.sub(r"[ \t\u3000]+", " ", line).strip()
        if line:
            out.append(line)
    return out


def extract_tarpaulin_nos(text):
    """从整页文本抽出篷布号（栏位或托运人记事）。"""
    found = []
    for m in _TARP_NO.finditer(text or ""):
        n = m.group(1).upper()
        if n not in found:
            found.append(n)
    return found


def is_railway_waybill(text):
    compact = re.sub(r"\s+", "", text or "")
    return "货物运单" in compact


def _compact_alnum_line(line):
    return re.sub(r"[\s\u3000]", "", line or "")


def _find_waybill_no(lines):
    for line in lines[:20]:
        compact = _compact_alnum_line(line)
        if _WAYBILL_NO.match(compact):
            return compact
        # J M B J G 0 0 8 8 1 7 3
        parts = line.split()
        if len(parts) >= 8 and all(len(p) == 1 for p in parts):
            joined = "".join(parts)
            if _WAYBILL_NO.match(joined):
                return joined
    return ""


def _line_eq(line, label):
    return _compact_alnum_line(line) == _compact_alnum_line(label)


def _find_idx(lines, label, start=0):
    for i in range(start, len(lines)):
        if _line_eq(lines[i], label) or lines[i].startswith(label):
            return i
    return -1


def _value_next(lines, label, start=0, skip=None):
    i = _find_idx(lines, label, start)
    if i < 0:
        return ""
    skip = skip or set()
    for j in range(i + 1, min(i + 8, len(lines))):
        s = lines[j]
        if s in skip or s in _NOISE_VAL:
            continue
        if s.startswith("□") or s.startswith("☑"):
            continue
        if _line_eq(s, label):
            continue
        return s
    return ""


def _inline_after(text, prefix):
    for line in _lines(text):
        if prefix in line:
            rest = line.split(prefix, 1)[1].strip(" :：")
            if rest:
                return rest
    return ""


def _block_between(lines, start_label, end_labels):
    i = -1
    for idx, line in enumerate(lines):
        if line.startswith(start_label):
            i = idx
            first = line.split(start_label, 1)[1].strip(" :：")
            break
    if i < 0:
        return ""
    chunks = [first] if first else []
    for j in range(i + 1, len(lines)):
        if any(lines[j].startswith(e) for e in end_labels):
            break
        chunks.append(lines[j])
    return "".join(chunks)


def _parse_cargo_items(lines):
    start = _find_idx(lines, "货物名称")
    if start < 0:
        return [], {}

    items = []
    i = start + 1
    while i < len(lines) and lines[i] in _HEADER_SKIP:
        i += 1

    while i < len(lines):
        line = lines[i]
        if line in ("选择", "服务") or line.startswith("□上门"):
            break
        if line == "合计":
            break
        if line in _HEADER_SKIP:
            i += 1
            continue
        # 品名行
        if re.search(r"[\u4e00-\u9fff]", line) and not line.startswith("□"):
            name = line
            pieces = ""
            weight = ""
            box_type = ""
            box_no = ""
            confirmed = ""
            rate_no = ""
            i += 1
            if i < len(lines) and re.fullmatch(r"\d+", lines[i]):
                pieces = lines[i]
                i += 1
            if i < len(lines):
                m = re.match(r"^(\d+(?:\.\d+)?)\s*(.*)$", lines[i])
                if m and not _BOX_NO.search(lines[i]):
                    weight = m.group(1)
                    box_type = (m.group(2) or "").strip()
                    i += 1
            if i < len(lines):
                bm = _BOX_NO.search(lines[i])
                if bm:
                    box_no = bm.group(1)
                    i += 1
            if i < len(lines) and re.fullmatch(r"\d+(?:\.\d+)?", lines[i]):
                confirmed = lines[i]
                i += 1
            if i < len(lines) and re.fullmatch(r"\d+", lines[i]) and len(lines[i]) <= 3:
                rate_no = lines[i]
                i += 1
            items.append(
                {
                    "cargo_name": name,
                    "pieces": pieces,
                    "weight": weight,
                    "box_type": box_type,
                    "box_no": box_no,
                    "confirmed_weight": confirmed,
                    "rate_no": rate_no,
                }
            )
            continue
        i += 1

    totals = {}
    t = _find_idx(lines, "合计", start)
    if t >= 0:
        nums = []
        for j in range(t + 1, min(t + 8, len(lines))):
            if lines[j] in ("选择", "服务"):
                break
            if re.fullmatch(r"\d+(?:\.\d+)?", lines[j]):
                nums.append(lines[j])
        if len(nums) >= 1:
            totals["pieces"] = nums[0]
        if len(nums) >= 2:
            totals["weight"] = nums[1]
        if len(nums) >= 3:
            totals["confirmed_weight"] = nums[2]
        if len(nums) >= 5:
            totals["charged_weight"] = nums[4]
        elif len(nums) >= 3:
            totals["charged_weight"] = nums[2]
    return items, totals


def _checked_options(line):
    """从 ☑电子 □现金 这类行取出已勾选项。"""
    picked = re.findall(r"☑\s*([^\s□☑]+)", line)
    return "、".join(picked)


def _invoice_address(lines):
    for i, line in enumerate(lines):
        if "地址电话" not in line:
            continue
        rest = line.split("地址电话", 1)[1].strip(" :：")
        if i + 1 < len(lines) and re.fullmatch(r"\d{11}", lines[i + 1].replace(" ", "")):
            rest = f"{rest} {lines[i + 1]}"
        return rest
    return ""


def parse_railway_waybill(text):
    lines = _lines(text)
    joined = "\n".join(lines)
    fields = {}

    bureau = ""
    for line in lines[:5]:
        if "铁路" in line and "公司" in line:
            bureau = line
            break

    consignor_idx = _find_idx(lines, "发站(公司)")
    if consignor_idx < 0:
        consignor_idx = _find_idx(lines, "发站")
    consignee_idx = _find_idx(lines, "到站(公司)")
    if consignee_idx < 0:
        consignee_idx = _find_idx(lines, "到站")

    # 托运人「名称」在发站之后、到站之前
    shipper = ""
    shipper_agent = ""
    shipper_mobile = ""
    if consignor_idx >= 0:
        name_i = _find_idx(lines, "名称", consignor_idx)
        if name_i >= 0 and (consignee_idx < 0 or name_i < consignee_idx):
            shipper = _value_next(lines, "名称", consignor_idx)
        shipper_agent = _value_next(lines, "经办人", consignor_idx)
        shipper_mobile = _value_next(lines, "手机号码", consignor_idx)

    consignee = ""
    consignee_agent = ""
    consignee_mobile = ""
    if consignee_idx >= 0:
        consignee = _value_next(lines, "名称", consignee_idx)
        consignee_agent = _value_next(lines, "经办人", consignee_idx)
        consignee_mobile = _value_next(lines, "手机号码", consignee_idx)

    items, totals = _parse_cargo_items(lines)
    box_nos = [it["box_no"] for it in items if it.get("box_no")]
    names = []
    for it in items:
        if it.get("cargo_name") and it["cargo_name"] not in names:
            names.append(it["cargo_name"])
    box_types = []
    for it in items:
        if it.get("box_type") and it["box_type"] not in box_types:
            box_types.append(it["box_type"])

    freight = _value_next(lines, "运费合计")
    freight_tax = ""
    fi = _find_idx(lines, "运费合计")
    if fi >= 0:
        nums = []
        for j in range(fi + 1, min(fi + 5, len(lines))):
            if re.fullmatch(r"\d+(?:\.\d+)?", lines[j].replace(",", "")):
                nums.append(lines[j])
        if nums:
            freight = nums[0]
        if len(nums) >= 2:
            freight_tax = nums[1]

    total_fee = _value_next(lines, "费用合计")
    total_fee = total_fee.replace("￥", "").replace("¥", "").strip()

    pay_line = next((ln for ln in lines if "电子" in ln and "现金" in ln), "")
    pickup_line = next((ln for ln in lines if "电子领货" in ln or "纸质领货" in ln), "")
    invoice_bits = [
        _checked_options(ln) for ln in lines if "普通票" in ln or "专用票" in ln
    ]
    invoice_type = "、".join(x for x in invoice_bits if x)

    stamp_tax = _value_next(lines, "印花税")
    load_fee = ""
    for i, ln in enumerate(lines):
        if "发站装卸费" in ln:
            m = re.search(r"发站装卸费\s*([\d.]+)", ln)
            if m:
                load_fee = m.group(1)
            elif i + 1 < len(lines) and re.match(r"[\d.]+", lines[i + 1]):
                load_fee = lines[i + 1]
            # 同行：0.0 发站装卸费 183.96
            m2 = re.search(r"发站装卸费\s*([\d.]+)", ln)
            if not load_fee:
                parts = re.findall(r"[\d.]+", ln)
                if parts:
                    load_fee = parts[-2] if len(parts) >= 2 else parts[-1]
            break

    fields = {
        "bureau": bureau,
        "ticket_no": _find_waybill_no(lines),
        "demand_no": (_DEMAND_NO.search(joined).group(1) if _DEMAND_NO.search(joined) else ""),
        "transport_type": "集装箱" if "集装箱" in joined else "",
        "from_station": _value_next(lines, "发站(公司)") or _value_next(lines, "发站"),
        "to_station": _value_next(lines, "到站(公司)") or _value_next(lines, "到站"),
        "shipper": shipper,
        "shipper_agent": shipper_agent,
        "shipper_mobile": shipper_mobile,
        "consignee": consignee,
        "consignee_agent": consignee_agent,
        "consignee_mobile": consignee_mobile,
        "deliver_days": _value_next(lines, "运到期限"),
        "marked_weight": _value_next(lines, "标重"),
        "loader": _value_next(lines, "装车方"),
        "sealer": _value_next(lines, "施封方"),
        "tarpaulin_nos": "、".join(extract_tarpaulin_nos(joined)),
        "pay_method": _checked_options(pay_line),
        "pickup_method": _checked_options(pickup_line),
        "invoice_type": invoice_type,
        "cargo_name": "、".join(names),
        "pieces": totals.get("pieces", ""),
        "weight": totals.get("weight", ""),
        "charged_weight": totals.get("charged_weight", ""),
        "box_type": "、".join(box_types),
        "box_no": "、".join(box_nos),
        "wagon_no": "、".join(box_nos),
        "freight": freight,
        "freight_tax": freight_tax,
        "stamp_tax": stamp_tax,
        "station_load_fee": load_fee,
        "total_fee": total_fee,
        "total_fee_cn": _inline_after(joined, "币：") or _inline_after(joined, "大写："),
        "invoice_title": _inline_after(joined, "受票方名称"),
        "tax_id": _inline_after(joined, "识别号"),
        "invoice_address": _invoice_address(lines),
        "bank_account": _inline_after(joined, "开户行及账号"),
        "shipper_notes": _block_between(lines, "托运人记事", ["承运人记事", "货运员", "承运人签章"]),
        "carrier_notes": _block_between(lines, "承运人记事", ["货运员", "承运人签章", "制单人"]),
        "maker": _inline_after(joined, "制单人"),
        "issue_date": _inline_after(joined, "制单日期"),
        "ship_date": _inline_after(joined, "制单日期"),
        "via": "",
        "package": "集装箱",
        "wagon_type": "、".join(box_types),
        "insurance": "",
        "cargo_detail": "；".join(
            f"{it.get('cargo_name','')} {it.get('pieces','')}件 {it.get('weight','')}kg {it.get('box_type','')} {it.get('box_no','')}".strip()
            for it in items
        ),
    }

    filled = sum(1 for k, v in fields.items() if v)
    if filled >= 12:
        conf = "货物运单字段较完整"
    elif filled >= 6:
        conf = "货物运单部分字段，建议核对"
    else:
        conf = "货物运单解析偏少，请核对版式"

    return {
        "doc_type": "铁路货物运单",
        "fields": fields,
        "cargo_items": items,
        "tarpaulin_list": extract_tarpaulin_nos(joined),
        "confidence_note": conf,
        "summary": joined[:400].replace("\n", " | "),
        "raw_text": joined,
    }
