# 铁路大票批量识别

把铁路货票 / 大票的 PDF 或扫描图片放进 `inbox`，批量识别后导出 Excel。

- 可检索 PDF：直接抽文字
- 扫描件 / 图片：用 RapidOCR 识别中文
- 解析字段：运单号、发到站、箱号、篷布号、托运人、费用等

## 环境

- Windows
- Python 3.10 或更高

```bat
cd /d e:\ai\r9_jq\cp_jq4\tielu
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

首次安装 RapidOCR 会下载 ONNX 模型，需要几分钟和网络。

## 用法

1. 把 PDF / jpg / png 放到 `tielu\inbox`（支持子文件夹）
2. 运行：

```bat
cd /d e:\ai\r9_jq\cp_jq4\tielu
python recognize.py
```

或双击 `run.bat`。

指定目录：

```bat
python recognize.py -i D:\票据\大票 -o D:\票据\识别结果 --save-raw
```

| 参数 | 说明 |
|------|------|
| `-i` / `--input` | 待识别目录，默认 `inbox` |
| `-o` / `--output` | 输出目录，默认 `output` |
| `--dpi` | 扫描渲染清晰度，默认 220，图糊可试 280 |
| `--force-ocr` | 有文字层也强制 OCR |
| `--save-raw` | 额外保存每页原文 txt |

## 输出

- `output/铁路大票识别结果_时间戳.xlsx`：主结果表
- `output/json/`：每文件结构化 JSON
- `output/raw_text/`：仅在加 `--save-raw` 时生成

Excel 里「置信说明」不是机器打分，是按解析到的字段多少给的核对提示。票面歪、糊、印章压字时请以原件为准。

## 多式联运数据库

铁路运单、集装箱、汽车趟次（含一车两箱）的 PostgreSQL 设计见：

- 说明文档：[`database/DATABASE.md`](database/DATABASE.md)
- 万吨委托与收发流水：[`database/ORDER_FLOW.md`](database/ORDER_FLOW.md)
- 篷布号管理：[`database/TARPAULIN.md`](database/TARPAULIN.md)
- 五流合一（货主发货到签收）：[`database/FIVE_STREAM.md`](database/FIVE_STREAM.md)
- 表结构总表：[`database/TABLES.md`](database/TABLES.md)
- 建表：`create_multimodal_schema.sql` → `create_order_flow.sql` → `create_tarpaulin.sql` → `create_five_stream.sql`
- 结构检查：`database/check_multimodal_schema.sql`、`database/check_order_flow.sql`

## 说明

本工具面向铁路 **货物运单 / 货票（货运大票）** 扫描件与电子 PDF，只解析货运字段（运单号、箱号、发到站、费用等）。
