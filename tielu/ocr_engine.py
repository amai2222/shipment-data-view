# OCR 引擎（扫描件）：优先 RapidOCR，未安装时给出明确提示


_engine = None


def get_ocr_engine():
    global _engine
    if _engine is not None:
        return _engine
    try:
        from rapidocr_onnxruntime import RapidOCR

        _engine = RapidOCR()
        return _engine
    except ImportError:
        try:
            from rapidocr import RapidOCR

            _engine = RapidOCR()
            return _engine
        except ImportError as exc:
            raise RuntimeError(
                "未安装 OCR 组件。请在 tielu 目录执行：pip install -r requirements.txt"
            ) from exc


def _unwrap_ocr_result(result):
    """兼容 RapidOCR 1.x 元组、2.x 对象、纯 list。"""
    if result is None:
        return []
    if hasattr(result, "txts"):
        txts = list(result.txts or [])
        boxes = list(getattr(result, "boxes", None) or [])
        out = []
        for i, text in enumerate(txts):
            box = boxes[i] if i < len(boxes) else [[0, 0], [0, 0], [0, 0], [0, 0]]
            out.append([box, text, 1.0])
        return out
    if isinstance(result, tuple):
        return result[0] or []
    return result or []


def ocr_image(pil_image):
    """对 PIL 图做中文 OCR，返回纯文本（按阅读顺序拼接）。"""
    import numpy as np

    engine = get_ocr_engine()
    arr = np.array(pil_image.convert("RGB"))
    result = engine(arr)
    lines = _unwrap_ocr_result(result)
    if not lines:
        return ""

    rows = []
    for item in lines:
        # [box, text, score]
        if not item:
            continue
        if isinstance(item, dict):
            text = item.get("text") or item.get("txt") or ""
            box = item.get("box") or item.get("dt_boxes") or [[0, 0]]
        else:
            box = item[0] if len(item) > 0 else [[0, 0]]
            text = item[1] if len(item) > 1 else ""
        if not text:
            continue
        try:
            ys = [p[1] for p in box]
            xs = [p[0] for p in box]
            y = sum(ys) / len(ys)
            x = sum(xs) / len(xs)
        except (TypeError, IndexError):
            y, x = 0, 0
        rows.append((y, x, str(text).strip()))

    rows.sort(key=lambda t: (round(t[0] / 12), t[1]))
    return "\n".join(t[2] for t in rows if t[2])
