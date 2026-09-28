# 五流合一：货主发货 → 多日运输 → 签收

先执行：`create_multimodal_schema.sql` → `create_order_flow.sql` → `create_tarpaulin.sql`（可选）→ **`create_five_stream.sql`**。

---

## 货主的货怎么走完

甲方/货主有 **1 万吨**，每天火车大约 **1200 吨**，要一直记到对方签收：

1. **商流**：货主档案 + 委托合同 + **发货指令**（确认发这批货）。  
2. **物流**：按日计划拆行；每发出一个箱，记一条实绩，直到签收。  
3. **信息流**：原有 `logistics_event` 每个节点仍记；发货单号挂上。  
4. **单证流**：发货单、铁路大票、公路单、发票、回单进 `doc_record`。  
5. **资金流**：向货主应收 `fin_ar`，应付铁路/车队 `fin_ap`，收付款 `fin_payment`，核销 `fin_match`。

```
货主 cargo_owner
  └── 委托 customer_order（1 万吨）
        └── 发货指令 shipping_order
              ├── 每日计划 shipping_order_line（1月3日 1200 吨…）
              └── 实绩 shipping_fulfillment（一箱一行：发出 → 在途 → 签收）
                    └── 箱 / 大票 / 两端汽车 / 篷布（原物流表）
```

**多日：** 指令上计划总吨；`shipping_order_line` 按 `plan_date` 拆天；当天 OCR 进来的箱挂到当天行上核销。  
**全程：** 箱的状态看 `shipping_fulfillment.status`（departed → in_transit → arrived → received），节点明细仍看流水。  
**顺利收到：** 该指令下所有 fulfillment 均为 `received`，指令 `status=received`；签收吨 = `v_shipping_order_progress.received_t`。

---

## 新增表

| 表 | 一行 | 主键 / 业务键 |
|----|------|----------------|
| `cargo_owner` | 一个货主 | id；name 唯一 |
| `shipping_order` | 一张发货指令 | id；ship_no 唯一 |
| `shipping_order_line` | 某一天的计划吨 | id；指令+日期唯一 |
| `shipping_fulfillment` | 一个箱从发到收 | id；container_id 有则唯一 |
| `doc_record` | 一份单证 | id |
| `fin_ar` | 一笔应收货主 | id |
| `fin_ap` | 一笔应付铁路/车队 | id |
| `fin_payment` | 一笔收款或付款 | id |
| `fin_match` | 一次核销 | id |

委托上增加 `cargo_owner_id`、`consignee_name`。运单/箱/流水可挂 `shipping_order_id`。

---

## 推荐记账顺序（每天重复直到 1 万吨走完）

1. 建货主、委托（计划 10000 吨、日均 1200）。  
2. 建发货指令，按日插入 line（1月3日～1月12日等）。货主确认后 `confirmed`。  
3. 当天发端汽车 + 火车大票 OCR → 箱入库 → 插入 `shipping_fulfillment`（挂当天 line，status=departed）。  
4. 写 `logistics_event`（装车、制票、到站、配送）。  
5. 签收：fulfillment `received` + `received_at`，流水 `signed`，单证 `pod`。  
6. 按指令或按吨出 `fin_ar`；铁路运费/汽车费出 `fin_ap`；款到 `fin_payment` + `fin_match`。

查看：

```sql
-- 这一箱货主侧走完没有
SELECT * FROM tielu.v_cargo_box_journey WHERE ship_no = 'FH-2024-001';

-- 这张发货单计划/已发/已收/应收
SELECT * FROM tielu.v_shipping_order_progress;
```

检查结构：`check_five_stream.sql`（一条命令，一张结果表）。
