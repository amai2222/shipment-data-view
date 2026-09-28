# PDF / 图片读入：可检索 PDF 抽文本，扫描件渲染后 OCR
import io
import re
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

from ocr_engine import ocr_image

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


def is_usable_text(text):
    """判断抽出的文字是否像真实中文票据（避免扫描件乱码）。"""
    if not text or len(text.strip()) < 12:
        return False
    cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
    return cjk >= 12


def render_page_to_pil(page, dpi=220):
    zoom = dpi / 72.0
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    return Image.open(io.BytesIO(pix.tobytes("png")))


def extract_pdf_pages(pdf_path, dpi=220, force_ocr=False):
    """
    产出每页: {page_no, text, method}
    method: text / ocr / mixed
    """
    doc = fitz.open(pdf_path)
    pages = []
    try:
        for i, page in enumerate(doc, start=1):
            raw = page.get_text("text") or ""
            method = "text"
            text = raw
            if force_ocr or not is_usable_text(raw):
                img = render_page_to_pil(page, dpi=dpi)
                ocr_text = ocr_image(img)
                if is_usable_text(raw) and ocr_text:
                    text = raw + "\n" + ocr_text
                    method = "mixed"
                else:
                    text = ocr_text or raw
                    method = "ocr"
            pages.append({"page_no": i, "text": text, "method": method})
    finally:
        doc.close()
    return pages


def extract_image_file(img_path, dpi=220):
    img = Image.open(img_path)
    # 超大图缩小，避免 OCR 过慢
    max_side = 3500
    w, h = img.size
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    text = ocr_image(img)
    return [{"page_no": 1, "text": text, "method": "ocr"}]


def extract_file(path, dpi=220, force_ocr=False):
    p = Path(path)
    suffix = p.suffix.lower()
    if suffix == ".pdf":
        return extract_pdf_pages(str(p), dpi=dpi, force_ocr=force_ocr)
    if suffix in IMAGE_EXT:
        return extract_image_file(str(p), dpi=dpi)
    raise ValueError(f"不支持的文件类型: {suffix}")
