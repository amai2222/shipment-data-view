# 甲方万吨委托：每日火车 + 收发全流程

先执行 `create_multimodal_schema.sql`，再执行 `create_order_flow.sql`。

---

## 问题怎么拆

甲方发 **一批货 1 万吨**，火车 **每天大约 1200 吨**：

- **1 万吨** = 一张 **委托**（`customer_order`），不是一张运单，也不是一天。  
- **1200 吨/天** = 这条委托下的 **执行日**（`order_day`），一天可以有十几张铁路运单、几十个箱、若干汽车趟次。  
- **每一箱、每一趟车、每一次签收** = **流水**（`logistics_event`），用来还原全部收发过程。

大约 10000 ÷ 1200 ≈ **9 个发运日**。每天仍按「运单 + 箱 + 发端车 + 收端车」记细账，向上汇总到日、再汇总到委托。

```
customer_order     甲方一批货  计划 10000 吨
    │
    ├─ order_day          1月3日 计划 1200 吨
    │      ├─ 当天铁路运单 / 箱
    │      ├─ 当天发端汽车趟次（一车可多箱）
    │      └─ 当天流水（装车、制票…）
    ├─ order_day          1月4日 计划 1200 吨
    │      └─ …
    └─ logistics_event    全周期时间线（发端+铁路+收端+签收）
```

吨数以 **吨 (t)** 记在委托/日/流水上；箱上仍是 **千克**，视图里 `/1000` 汇总。

---

## 一张货要经过的节点

每个箱建议至少留下这些流水（缺了哪步，`v_container_flow_status` 对应列为 false）：

| 顺序 | event_type | direction | 谁在干什么 |
|------|------------|-----------|------------|
| 1 | `order_opened` | outbound | 甲方下单，计划 1 万吨 |
| 2 | `pickup_loaded` | outbound | 发端：货装上汽车（一车可多箱） |
| 3 | `pickup_at_station` | outbound | 发端：送到发站 |
| 4 | `rail_loaded` | internal | 装火车 / 箱进站 |
| 5 | `rail_departed` | internal | 制票发出（挂铁路运单号） |
| 6 | `rail_in_transit` | internal | 在途（可选，过轨/编组） |
| 7 | `rail_arrived` | internal | 火车到站 |
| 8 | `delivery_loaded` | inbound | 收端：装上汽车（一车可多箱，组合可与发端不同） |
| 9 | `delivery_arrived` | inbound | 送到厂/库 |
| 10 | `signed` | inbound | 签收 |
| — | `shortage` / `damage` | inbound | 短少、货损 |

**不要**把 9 天发运记成一条「发货」。每天、每箱、每趟车都要能查到。

---

## 表

| 表 | 一行是什么 |
|----|------------|
| `customer_order` | 甲方这一批 1 万吨 |
| `order_day` | 其中某一天（计划吨，如 1200） |
| `logistics_event` | 一次收发动作 |
| 原有 `rail_waybill` / `rail_container` / `truck_trip` | 票、箱、汽车趟次，通过 `order_id` 挂到委托 |

`order_day` **只存当天计划**，当天实际发了多少吨 = 当天运单箱重之和（`v_order_daily_progress.day_rail_actual_t`），不要在日表上再手填一份「实绩」当主数据。

写入流水可用函数（会自动建当天 `order_day`）：

```sql
SELECT tielu.log_flow_event(
  p_order_id    := '...uuid...',
  p_event_type  := 'rail_departed',
  p_direction   := 'internal',
  p_occurred_at := now(),
  p_place       := '佳木斯站',
  p_weight_t    := 64,
  p_waybill_id  := '...',
  p_ticket_no   := 'JMBJG0088173',
  p_note        := '当日计划1200吨中的一票'
);
```

---

## 进度怎么看

```sql
-- 整票：计划 / 已上火车 / 已签收 / 还没发完
SELECT * FROM tielu.v_order_progress;

-- 每天是否凑够约 1200 吨
SELECT order_no, biz_date, day_plan_t, day_rail_actual_t, day_waybill_count
FROM tielu.v_order_daily_progress
ORDER BY biz_date;

-- 全流程时间线
SELECT occurred_at, direction, event_type, place_name, weight_t, ticket_no, box_no, plate_no
FROM tielu.v_order_timeline
WHERE order_no = '甲方2024-001'
ORDER BY occurred_at;

-- 哪个箱卡在哪一步（已装火车未到站、已到站未配送…）
SELECT * FROM tielu.v_container_flow_status
WHERE order_id = '...';
```

剩余未上火车：`remain_to_rail_t = plan_weight_t - rail_shipped_t`。  
在途可近似：已 `rail_departed` 且尚未 `signed` 的箱重（用流水或箱状态视图筛）。

---

## 推荐记账顺序（每一天重复）

1. 委托已存在（1 万吨、日计划 1200）。  
2. 当天发端派车 → `truck_trip`（`leg=pickup`）+ 挂箱 + 写 `pickup_loaded` / `pickup_at_station`。  
3. OCR 铁路大票入库 → 运单/箱填 `order_id`、`issue_date=当天` → 写 `rail_departed`（按票或按箱）。  
4. 到站后写 `rail_arrived`。  
5. 收端派车 → `leg=delivery` 挂箱（可与发端不同组合）→ `delivery_loaded` / `delivery_arrived` / `signed`。  
6. 看当日 `day_rail_actual_t` 是否接近 1200；整票 `remain_to_rail_t` 是否降到 0。

发端一车多箱、收端一车多箱：仍是一趟 N 行 `container_truck`；流水按 **箱** 记（一车三箱就三条 `pickup_loaded`），趟次运费仍一笔。

---

## 执行

1. `create_multimodal_schema.sql`  
2. `create_order_flow.sql`  
3. 可选 `example_order_daily_rail.sql`  
4. `check_order_flow.sql`（一条命令，一张结果表）
