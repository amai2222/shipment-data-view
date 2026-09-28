# 多式联运数据库说明

适用：铁路货物运单（大票）OCR 入库 + 公路派车/回单勾稽。  
引擎：**PostgreSQL 14+ / Supabase**。  
建表脚本：`create_multimodal_schema.sql`（整文件一次执行）。

甲方 **一批 1 万吨、每天火车约 1200 吨、要记全收发过程** 见专文：  
[`ORDER_FLOW.md`](ORDER_FLOW.md)（委托 / 执行日 / 流水）。

篷布号建档、挂票、收回见：[`TARPAULIN.md`](TARPAULIN.md)。  
**全部表/字段/主键/外键总表：** [`TABLES.md`](TABLES.md)（含英文字段名）。  
**中文字段版（对接陆运五流）：** [`TABLES_ZH.md`](TABLES_ZH.md)。  
**货主发货到签收（五流合一）：** [`FIVE_STREAM.md`](FIVE_STREAM.md)。

---

## 1. 设计目标

解决三件事：

1. 一批货有多张铁路运单、每票又有多个集装箱。  
2. **发端一辆车可装多个箱，收端一辆车也可装多个箱**（数量不必相同，组合不必相同）。  
3. 发站短驳和到站配送是两段公路，必须两趟车分别记，不能写在同一趟上。

核心原则：

| 原则 | 含义 |
|------|------|
| 批次只分组 | 不在批次上写唯一车牌 |
| 运单按票结算铁路费 | 运单表不写车牌 |
| **箱是铁公对货主键** | 用箱号对公路派车单 |
| 汽车按「趟次」 | 一车 N 箱 = 1 条趟次 + N 条关系 |

对象关系：

```
shipment_batch  1 ──N  rail_waybill  1 ──N  rail_container
       │                                         │
       │                                         N
       │                                         │
       └── N  truck_trip  1 ──N  container_truck ┘
```

---

## 2. 表一览

| 表 | 一行代表什么 | 业务主键 |
|----|----------------|----------|
| `tielu.shipment_batch` | 一票多式联运（如丰运网岭 6 车） | `batch_no`（一口价/委托号，可空） |
| `tielu.rail_waybill` | 一张铁路货物运单 | `ticket_no` 全局唯一 |
| `tielu.rail_container` | 一个集装箱 | 运单内 `box_no` 唯一；批次内 `box_no` 唯一 |
| `tielu.truck_trip` | 汽车的一趟（有装有卸） | 车牌 + 发车时间 + `leg`（应用层防重） |
| `tielu.container_truck` | 「某箱在某路段由某趟车拉」 | 有效状态下 `(container_id, leg)` 唯一 |
| `tielu.truck_vehicle` | 车辆档案（可选） | `plate_no` |
| `tielu.driver` | 司机档案（可选） | 无强制唯一 |
| `tielu.ocr_import` | 某次 PDF 导入痕迹 | 无 |

`leg` 取值：

- `pickup`：发站短驳（站 ↔ 货场/工厂）  
- `delivery`：到站配送  
- `highway`：纯公路干线（若有）

---

## 3. 发端 / 收端一车多箱（已按此建模）

发端、收端是 **两段独立公路**，用 `leg` 区分：

- 发端短驳：`truck_trip.leg = pickup`  
- 收端配送：`truck_trip.leg = delivery`

**一车多箱**：同一 `trip_id` 下挂多行 `container_truck`，一箱一行，箱不合并、车不复制。  
**两端组合可以不同**：发端哪几个箱拼一辆车，与收端哪几个箱拼一辆车，没有必须一致的约束。

举例（3 个箱）：

```
铁路箱：A  B  C

发端 pickup  车甲 ── 箱 A、B、C     （1 趟，3 行关系）
收端 delivery 车乙 ── 箱 A、B       （1 趟，2 行关系）
收端 delivery 车丙 ── 箱 C          （1 趟，1 行关系）
```

库里是：`truck_trip` 3 条（甲/乙/丙），`container_truck` 有效行 3+2+1=6。  
箱 A 有两条有效关系：`leg=pickup` 对甲、`leg=delivery` 对乙。唯一索引是 `(箱, 路段)`，所以同一箱在发端、收端可以各挂一辆车。

同一端（例如都是 delivery）同一箱不能同时挂两辆有效车。

落库形态（收端一车两箱示例，发端同理只改 `leg=pickup`）：

| 表 | 插入行数 | 内容 |
|----|----------|------|
| `truck_trip` | 1 | 车牌、司机、`leg`、公路运费 **整车一笔** |
| `container_truck` | N | N 个箱都指向同一 `trip_id`，`load_order` 为 1…N |
| `rail_container` | N | OCR 明细原样，不合并 |

禁止：

- 把多箱合成一条集装箱记录（对不上铁路票）。  
- 一车多箱却复制成多辆车 / 多趟（运费、轨迹翻倍）。  
- 只在 `shipment_batch` 上写一个车牌（无法证明拉的是哪些箱）。  
- 把发端、收端写进 **同一条** `truck_trip`（必须拆成 pickup / delivery 两趟）。

库内约束：

- 同一箱、同一 `leg`、`status=active` **只能挂一趟车**。  
- 同一趟、同一箱不能重复挂。  
- 关系上的 `leg` 必须等于趟次上的 `leg`。  
- **一趟挂几个箱不限制**（3 箱、6 箱都可以；用视图 `v_trip_with_boxes.box_count` 核对）。

半路换车：旧关系 `status='replaced'`，再插一条 `active`。不要改旧行的 `trip_id`。

插入示例见 `example_one_truck_two_boxes.sql`（收端两箱；发端多箱按同样方式再插一条 `leg=pickup` 的趟次即可）。

---

## 4. 字段与 OCR 对照

### 4.1 批次 `shipment_batch`

| 列 | 说明 | OCR 来源 |
|----|------|----------|
| `batch_no` | 一口价/委托号 | 托运人记事如 `一口价HB242902e号` |
| `name` | 批次名 | 可用 PDF 文件名 |
| `cargo_owner` | 货权人 | 记事「此货归…所有」 |
| `origin_station` / `dest_station` | 发到站 | 运单发站/到站 |
| `ship_date` | 批次日期 | 制单日期 |
| `status` | open / in_transit / completed / cancelled | 业务维护 |

### 4.2 运单 `rail_waybill`

对应 Excel「运单汇总」一行。铁路运费、印花税、装卸费、费用合计记在本表。  
**不要**在本表加 `plate_no`。

重要列：`ticket_no`、`demand_no`、`from_station`、`to_station`、收发货人及经办人手机、`freight_amt`、`total_fee`、`shipper_notes`、`raw_json`（整页字段备份）。

### 4.3 箱 `rail_container`

对应 Excel「集装箱明细」一行。  
`box_no` 是与汽车勾稽的键（如 `TBJU0916473`）。

`batch_id` 冗余自运单批次，方便按批次查箱，写入时与运单保持一致。

### 4.4 趟次 `truck_trip`

公路运费、过路费、司机电话、公路运单号记在本表。  
`plate_no` 必填（快照）。有档案时再填 `vehicle_id` / `driver_id`。

同一批次到站若多箱拼车，有几趟派车就几条 `truck_trip`，每趟下面挂该车实际装的那些箱。

### 4.5 关系 `container_truck`

| 列 | 说明 |
|----|------|
| `container_id` | 哪个箱 |
| `trip_id` | 哪趟车 |
| `leg` | 必须与趟次相同 |
| `load_order` | 本趟第几个箱（1、2、3…） |
| `status` | active / replaced / cancelled |

---

## 5. 费用记在哪

| 费用 | 表 | 原因 |
|------|----|------|
| 铁路运费、税额、印花税、发站装卸、票面合计 | `rail_waybill` | 按票与铁路结算 |
| 货重、箱型 | `rail_container` | 按箱对货、对装载 |
| 公路运费、过路费 | `truck_trip` | **整车一笔**；两箱不拆两份实付 |
| 批次总成本 | 视图 `v_batch_cost` | 运单合计 + 趟次合计，不在批次表抄总额当主数据 |

单箱公路成本仅报表分摊（重量或箱数均分），不要写成两笔付款。

---

## 6. 视图（查询入口）

| 视图 | 用途 |
|------|------|
| `v_container_multimodal` | 一箱一行：运单号 + 箱号 + 当前有效车牌 |
| `v_trip_with_boxes` | 一趟一行：`box_count`、箱号顿号拼接；一车两箱则 `box_count=2` |
| `v_batch_cost` | 一批一行：运单数、箱数、趟次数、铁路费、公路费 |

常用 SQL：

```sql
-- 这辆车拉了哪些火车箱号
SELECT plate_no, box_count, box_nos
FROM tielu.v_trip_with_boxes
WHERE plate_no = '湘A12345';

-- 这个箱到站是哪辆车
SELECT box_no, ticket_no, plate_no, driver_name, truck_freight
FROM tielu.v_container_multimodal
WHERE box_no = 'TBJU0916473' AND leg = 'delivery';

-- 这张铁路运单两端公路
SELECT *
FROM tielu.v_container_multimodal
WHERE ticket_no = 'JMBJG0088173';
```

---

## 7. 推荐写入顺序

1. 找或建 `shipment_batch`（一口价号或文件名）。  
2. 插入 `rail_waybill`（OCR 汇总）。  
3. 插入 `rail_container`（OCR 明细，`waybill_id` + `batch_id`）。  
4. 公路单到达后：建 `truck_trip`（先不要拆箱）。  
5. 按公路单上的箱号匹配 `rail_container.box_no`，插入 `container_truck`。  
6. 匹配失败进人工队列，**禁止**按批次随便绑一辆车。

两端公路：同一箱允许两条有效关系，但 `leg` 必须不同（`pickup` 与 `delivery`）。唯一索引是 `(container_id, leg)`，不是只按箱号一条。发端拼了 3 箱、收端拆成 2+1，只要箱号对上即可，不必两端同车同组。

---

## 8. 如何执行

在 Supabase SQL Editor 或 `psql`：

1. 复制执行 `create_multimodal_schema.sql`（运单/箱/汽车）。  
2. 复制执行 `create_order_flow.sql`（甲方委托、每日计划、收发流水）。  
3. 复制执行 `create_tarpaulin.sql`（篷布档案与挂票）。  
4. （可选）`example_one_truck_two_boxes.sql`、`example_order_daily_rail.sql`。  
5. 检查：`check_multimodal_schema.sql`、`check_order_flow.sql`、`check_tarpaulin.sql`。

与现有 `vbet_monitor` 表隔离在 schema `tielu` 下，互不影响。

OCR Python（`recognize.py`）目前仍导出 Excel；入库可按本说明把 JSON 写入上述表，尚未做自动导入程序。

---

## 9. 约束与触发器清单

| 名称 | 作用 |
|------|------|
| `uq_tielu_waybill_ticket` | 运单号不重复 |
| `uq_tielu_container_box_waybill` | 同一运单箱号不重复 |
| `uq_tielu_container_box_in_batch` | 同一批次箱号不重复 |
| `uq_tielu_box_leg_active` | 一箱一路段只有一趟有效车 |
| `uq_tielu_trip_container` | 一趟不重复挂同一箱 |
| `trg_ct_leg_match` | 关系 leg = 趟次 leg |

一趟挂几个箱 **没有上限触发器**。若业务上要告警「一车超过 4 箱」，在应用层或报表用 `v_trip_with_boxes.box_count` 判断即可。
