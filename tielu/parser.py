# 铁路大票 / 货票 / 运单 字段解析
import re

# 结果表列顺序（中文表头）
EXCEL_COLUMNS = [
    "文件名",
    "页码",
    "识别方式",
    "单据类型",
    "票号",
    "需求号",
    "铁路局",
    "运输方式",
    "填发日期",
    "承运日期",
    "发站",
    "到站",
    "经由",
    "托运人",
    "托运人经办人",
    "托运人手机",
    "收货人",
    "收货人经办人",
    "收货人手机",
    "运到期限",
    "标重",
    "装车方",
    "施封方",
    "篷布号",
    "付费方式",
    "领货方式",
    "货物名称",
    "货物明细",
    "包装",
    "件数",
    "重量",
    "计费重量",
    "箱型箱类",
    "箱号",
    "车种",
    "车号",
    "运费",
    "运费税额",
    "印花税",
    "发站装卸费",
    "保价",
    "合计金额",
    "金额大写",
    "发票类型",
    "受票方",
    "识别号",
    "地址电话",
    "开户行及账号",
    "托运人记事",
    "承运人记事",
    "制单人",
    "置信说明",
    "原文摘要",
]

CARGO_COLUMNS = [
    "文件名",
    "页码",
    "运单号",
    "需求号",
    "发站",
    "到站",
    "货物名称",
    "件数",
    "重量kg",
    "箱型箱类",
    "箱号",
    "承运人确定重量kg",
    "运价号",
]

TARP_COLUMNS = [
    "文件名",
    "页码",
    "运单号",
    "篷布号",
    "来源",
]

LABEL_MAP = [
    ("ticket_no", ["货票号码", "货票号", "运单号", "票号", "票据号码"]),
    ("issue_date", ["填发日期", "制票日期", "开票日期", "填发"]),
    ("ship_date", ["承运日期", "承运于", "装车日期"]),
    ("from_station", ["发站", "始发站", "发货站"]),
    ("to_station", ["到站", "到达站", "终到站"]),
    ("via", ["经由", "径由"]),
    ("shipper", ["托运人名称", "托运人", "发货人"]),
    ("consignee", ["收货人名称", "收货人"]),
    ("cargo_name", ["货物名称", "品名"]),
    ("package", ["包装", "包装种类"]),
    ("pieces", ["件数"]),
    ("weight", ["货物重量", "实际重量", "重量"]),
    ("charged_weight", ["计费重量", "计费重"]),
    ("wagon_type", ["车种车号", "车种"]),
    ("wagon_no", ["车号", "货车号码"]),
    ("tarpaulin_nos", ["篷布号"]),
    ("freight", ["运费", "运输费用"]),
    ("insurance", ["保价", "保险费"]),
    ("total_fee", ["合计", "费用合计", "总金额"]),
]

# 标签后取值时丢掉的噪声
_NOISE = re.compile(
    r"^(甲联|乙联|丙联|丁联|货票|铁路|货物运单|货物运输|专用)$"
)
_DATE = re.compile(
    r"(20\d{2}[-./年]\d{1,2}[-./月]\d{1,2}日?|\d{4}年\d{1,2}月\d{1,2}日)"
)
_TICKET_NO = re.compile(
    r"(?:货票|运单|票)(?:号码|号)?[:：\s]*([A-Za-z]?\d{5,20})"
)
_WAGON = re.compile(r"([A-Z]{1,3}\d{5,8})")


def _clean(s):
    if s is None:
        return ""
    t = re.sub(r"[\s\u3000]+", " ", str(s)).strip(" :：|-_—")
    t = t.replace(" ", "")
    return t


def _lines(text):
    raw = (text or "").replace("\r", "\n")
    out = []
    for line in raw.split("\n"):
        line = re.sub(r"[ \t\u3000]+", " ", line).strip()
        if line:
            out.append(line)
    return out


def _value_after_label(lines, labels):
    """同行优先，否则取下一行（跳过纯标签噪声）。"""
    for i, line in enumerate(lines):
        for lab in labels:
            if lab not in line:
                continue
            # 「重量」不要命中「计费重量」整词
            if lab == "重量" and "计费重量" in line and "货物重量" not in line and "实际重量" not in line:
                continue
            if lab == "车号" and "车种车号" in line:
                continue
            idx = line.find(lab)
            rest = _clean(line[idx + len(lab) :])
            rest = re.sub(r"^[的是为]", "", rest)
            if rest and not _NOISE.match(rest) and rest not in labels:
                # 「车种车号」整段时先不当车号
                if lab == "车种" and "车号" in rest[:4]:
                    continue
                return rest
            if i + 1 < len(lines):
                nxt = _clean(lines[i + 1])
                if nxt and nxt not in labels and not _NOISE.match(nxt):
                    skip = False
                    for _, labs in LABEL_MAP:
                        if any(nxt == x or nxt.startswith(x) for x in labs):
                            skip = True
                            break
                    if not skip:
                        return nxt
    return ""


def detect_doc_type(text):
    t = text or ""
    if any(k in t for k in ("货票", "货物运单", "托运人", "计费重量", "发站")):
        return "铁路货票/大票"
    if "运单" in t:
        return "铁路运单"
    return "未识别"


def parse_ticket_text(text):
    """从整页识别文本抽出结构化字段。"""
    from waybill_parser import extract_tarpaulin_nos, is_railway_waybill, parse_railway_waybill

    if is_railway_waybill(text):
        return parse_railway_waybill(text)

    lines = _lines(text)
    fields = {}
    for key, labels in LABEL_MAP:
        fields[key] = _value_after_label(lines, labels)

    joined = "\n".join(lines)

    if not fields.get("ticket_no"):
        m = _TICKET_NO.search(joined)
        if m:
            fields["ticket_no"] = m.group(1)

    if not fields.get("issue_date"):
        m = _DATE.search(joined)
        if m:
            fields["issue_date"] = m.group(1)

    if not fields.get("wagon_no"):
        m = _WAGON.search(joined)
        if m:
            fields["wagon_no"] = m.group(1)

    tarp = extract_tarpaulin_nos(joined)
    if tarp:
        fields["tarpaulin_nos"] = "、".join(tarp)

    # 件数：只要数字
    if fields.get("pieces"):
        m = re.search(r"(\d+)", fields["pieces"])
        if m:
            fields["pieces"] = m.group(1)

    doc_type = detect_doc_type(joined)

    filled = sum(1 for k, v in fields.items() if v)
    if filled >= 6:
        conf = "字段较完整"
    elif filled >= 3:
        conf = "部分字段，建议核对原文"
    elif filled >= 1:
        conf = "仅识别到少量字段，请核对扫描清晰度"
    else:
        conf = "几乎未解析到字段，可能不是货票或图太糊"

    summary = joined[:400].replace("\n", " | ")

    return {
        "doc_type": doc_type,
        "fields": fields,
        "confidence_note": conf,
        "summary": summary,
        "raw_text": joined,
        "tarpaulin_list": tarp,
    }


def row_for_excel(file_name, page_no, method, parsed):
    f = parsed["fields"]
    return {
        "文件名": file_name,
        "页码": page_no,
        "识别方式": method,
        "单据类型": parsed["doc_type"],
        "票号": f.get("ticket_no", ""),
        "需求号": f.get("demand_no", ""),
        "铁路局": f.get("bureau", ""),
        "运输方式": f.get("transport_type", ""),
        "填发日期": f.get("issue_date", ""),
        "承运日期": f.get("ship_date", ""),
        "发站": f.get("from_station", ""),
        "到站": f.get("to_station", ""),
        "经由": f.get("via", ""),
        "托运人": f.get("shipper", ""),
        "托运人经办人": f.get("shipper_agent", ""),
        "托运人手机": f.get("shipper_mobile", ""),
        "收货人": f.get("consignee", ""),
        "收货人经办人": f.get("consignee_agent", ""),
        "收货人手机": f.get("consignee_mobile", ""),
        "运到期限": f.get("deliver_days", ""),
        "标重": f.get("marked_weight", ""),
        "装车方": f.get("loader", ""),
        "施封方": f.get("sealer", ""),
        "篷布号": f.get("tarpaulin_nos", ""),
        "付费方式": f.get("pay_method", ""),
        "领货方式": f.get("pickup_method", ""),
        "货物名称": f.get("cargo_name", ""),
        "货物明细": f.get("cargo_detail", ""),
        "包装": f.get("package", ""),
        "件数": f.get("pieces", ""),
        "重量": f.get("weight", ""),
        "计费重量": f.get("charged_weight", ""),
        "箱型箱类": f.get("box_type", ""),
        "箱号": f.get("box_no", ""),
        "车种": f.get("wagon_type", ""),
        "车号": f.get("wagon_no", ""),
        "运费": f.get("freight", ""),
        "运费税额": f.get("freight_tax", ""),
        "印花税": f.get("stamp_tax", ""),
        "发站装卸费": f.get("station_load_fee", ""),
        "保价": f.get("insurance", ""),
        "合计金额": f.get("total_fee", ""),
        "金额大写": f.get("total_fee_cn", ""),
        "发票类型": f.get("invoice_type", ""),
        "受票方": f.get("invoice_title", ""),
        "识别号": f.get("tax_id", ""),
        "地址电话": f.get("invoice_address", ""),
        "开户行及账号": f.get("bank_account", ""),
        "托运人记事": f.get("shipper_notes", ""),
        "承运人记事": f.get("carrier_notes", ""),
        "制单人": f.get("maker", ""),
        "置信说明": parsed["confidence_note"],
        "原文摘要": parsed["summary"],
    }
