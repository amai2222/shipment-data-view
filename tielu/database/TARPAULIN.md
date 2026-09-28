# 篷布号记录与管理

货物运单上有「篷布号」栏；托运人记事里也常写自备编号（如 `ZD22060102`、`ZE220102212`）。

## 识别

`recognize.py` 会：

- 汇总表增加 **篷布号**（一票多个用顿号拼接）
- 增加工作表 **篷布明细**（一号一行）

规则：从全文抓 `ZD`/`ZE` + 数字（与现有大票记事一致）。栏位为空、号码写在记事里也能抓到。

## 库表（先跑 `create_multimodal_schema.sql`，再跑 `create_tarpaulin.sql`）

| 表 | 一行是什么 | 主键 / 业务键 |
|----|------------|----------------|
| `tarpaulin` | 一块篷布或一根篷杆 | `id`；`tarp_no` 全局唯一 |
| `tarpaulin_use` | 这次随哪张大票发出 | `id`；**一块布同时只能一条 `active`** |
| `tarpaulin_ledger` | 建档/挂出/收回/丢失/报废流水 | `id` |

运单上冗余 `rail_waybill.tarpaulin_nos`，方便 OCR 写入；管理以 `tarpaulin_use` 为准。

`kind`：`cover` 篷布 / `pole` 篷杆。记事里两种编号可先都当 `cover`，再人工改。  
`owner_type`：`shipper` 托运人自备 / `railway` 路用 / `company` 我方。

状态：`idle` 闲置 → 挂票 `bound` / `in_transit` → 收回 `idle`；丢失 `lost`，报废 `scrapped`。

## 怎么用

OCR 入库运单后：

```sql
SELECT tielu.register_tarps_from_waybill('运单uuid');
```

会建档（已有号则复用）并挂到本票。若该号已挂在别的运单上且未收回，会报错。

到站收回：

```sql
UPDATE tielu.tarpaulin_use
SET status = 'returned', unbound_at = now()
WHERE tarp_id = '...' AND status = 'active';

UPDATE tielu.tarpaulin SET status = 'idle', updated_at = now() WHERE id = '...';

INSERT INTO tielu.tarpaulin_ledger (tarp_id, action, waybill_id, note)
VALUES ('...', 'unbind', '...', '到站收回');
```

在用清单：

```sql
SELECT * FROM tielu.v_tarpaulin_now;
```

一块布对多张历史运单：多条 `tarpaulin_use`（旧的 `returned`），同时只能有一条 `active`。一张运单多块布：多条 `use` 指向同一 `waybill_id`。
