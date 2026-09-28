# 全部数据表、字段、主键与关联

schema：`tielu`。每张表都有技术主键 **`id`（uuid）**。  
建表顺序：`create_multimodal_schema.sql` → `create_order_flow.sql` → `create_tarpaulin.sql` → `create_five_stream.sql`。

---

## 总图（谁连谁）

```
cargo_owner 货主
  └── customer_order 委托（可跨多日、万吨级）
        ├── order_day / logistics_event
        ├── shipping_order 发货指令
        │     ├── shipping_order_line 每日计划
        │     └── shipping_fulfillment 一箱从发到签收
        ├── shipment_batch
        ├── rail_waybill ── rail_container
        │         ├── container_truck ── truck_trip
        │         └── tarpaulin_use ── tarpaulin
        ├── doc_record 单证
        └── fin_ar 应收  ← fin_match ← fin_payment
            fin_ap 应付  ←┘
```

箱和汽车：`container_truck`（一趟对多箱；一箱发端、收端各一条有效）。  
篷布和大票：`tarpaulin_use`（一票对多布；一块布同时只能一条 active）。

---

## 1. `customer_order` 甲方委托

一行 = 一批货的合同（例如计划 1 万吨）。

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| cargo_owner_id | → `cargo_owner.id`（五流脚本后） |
| consignee_name | 收货方名称 |
| order_no | 委托号，**唯一** |
| party_a | 甲方 |
| cargo_name | 货名 |
| plan_weight_t | 计划总吨 |
| daily_plan_weight_t | 日均计划吨（如 1200） |
| origin_place / dest_place | 起讫 |
| plan_start_date / plan_end_date | 计划起止 |
| status | draft / executing / completed / cancelled |
| remark | 备注 |
| created_at / updated_at | 时间 |

**外键：** 无（被别的表引用）。

---

## 2. `order_day` 执行日

一行 = 该委托的某一天。

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| order_id | → `customer_order.id`，必填 |
| biz_date | 业务日 |
| plan_weight_t | 当天计划吨 |
| remark / created_at | |

**唯一：** `(order_id, biz_date)`  
当天实发吨不手填，用当天运单箱重汇总。

---

## 3. `shipment_batch` 铁路批次

一行 = 一组运单（如「丰运网岭6车」）。

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| order_id | → `customer_order.id`，可空 |
| batch_no | 一口价/委托号，**有值则唯一** |
| name | 批次名，必填 |
| cargo_owner | 货权人 |
| origin_station / dest_station | 发到站 |
| ship_date | 日期 |
| status | open / in_transit / completed / cancelled |
| remark / created_at / updated_at | |

---

## 4. `rail_waybill` 铁路货物运单

一行 = 一张货运大票。

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| batch_id | → `shipment_batch.id` |
| order_id | → `customer_order.id` |
| ticket_no | 运单号，**全局唯一** |
| demand_no | 需求号 |
| bureau | 铁路局 |
| transport_type | 如集装箱 |
| issue_date / ship_date | 制单/承运日 |
| from_station / to_station / via_route | 发到站、经由 |
| shipper / shipper_agent / shipper_mobile | 托运人 |
| consignee / consignee_agent / consignee_mobile | 收货人 |
| deliver_days | 运到期限 |
| marked_weight | 标重 |
| loader / sealer | 装车方、施封方 |
| pay_method / pickup_method | 付费、领货 |
| cargo_name / cargo_detail / package_type | 货物 |
| pieces_total / weight_kg / charged_weight_kg | 件数重量 |
| box_type | 箱型（票面汇总） |
| freight_amt / freight_tax / stamp_tax / station_load_fee / insurance_amt / total_fee / total_fee_cn | 费用 |
| invoice_type / invoice_title / tax_id / invoice_address / bank_account | 发票 |
| shipper_notes / carrier_notes | 记事 |
| maker | 制单人 |
| tarpaulin_nos | 篷布号顿号拼接（明细以 use 表为准） |
| source_file / source_page / ocr_method / raw_json | OCR |
| created_at / updated_at | |

**不写车牌。** 铁路费记本表。

---

## 5. `rail_container` 集装箱

一行 = 一个箱号。

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| waybill_id | → `rail_waybill.id`，必填，删运单级联删箱 |
| batch_id | → `shipment_batch.id` |
| box_no | 箱号 |
| cargo_name / pieces / weight_kg / confirmed_weight_kg / box_type / rate_no | |
| created_at | |

**唯一：** `(waybill_id, box_no)`；`(batch_id, box_no)`（batch 非空时）。  
汽车、篷布对货都靠这一行。

---

## 6. `truck_vehicle` 车辆档案（可选）

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| plate_no | 车牌，**唯一** |
| axle_desc / fleet_name / status / created_at | |

---

## 7. `driver` 司机档案（可选）

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| name | 必填 |
| phone / id_no / created_at | |

---

## 8. `truck_trip` 汽车趟次

一行 = 发端或收端跑的一趟（一车多箱仍一行）。

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| batch_id | → `shipment_batch.id` |
| order_id | → `customer_order.id` |
| vehicle_id | → `truck_vehicle.id` |
| driver_id | → `driver.id` |
| plate_no | 车牌快照，必填 |
| driver_name / driver_phone | 快照 |
| leg | pickup 发端 / delivery 收端 / highway |
| highway_waybill_no | 公路单号 |
| from_place / to_place / depart_at / arrive_at | |
| freight_amt / toll_amt / other_amt | 公路费整车一笔 |
| status | planned / running / done / cancelled |
| source_file / raw_json / remark / created_at / updated_at | |

---

## 9. `container_truck` 箱 ↔ 汽车

一行 = 某个箱在某一端上了某一趟车。

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| container_id | → `rail_container.id`，必填 |
| trip_id | → `truck_trip.id`，必填 |
| leg | 必须与该趟次 leg 相同 |
| load_order | 本趟第几个箱 |
| status | active / replaced / cancelled |
| remark / created_at | |

**有效唯一：** `(container_id, leg)` 且 active；`(trip_id, container_id)` 且 active。

---

## 10. `tarpaulin` 篷布档案

一行 = 一块篷布或一根篷杆。

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| tarp_no | 篷布号，**全局唯一** |
| kind | cover / pole / other |
| owner_type | shipper / railway / company |
| owner_name | 自备货主名 |
| status | idle / bound / in_transit / overdue / lost / scrapped |
| remark / created_at / updated_at | |

---

## 11. `tarpaulin_use` 篷布挂票

一行 = 这块布这次跟哪张大票走。

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| tarp_id | → `tarpaulin.id`，必填 |
| waybill_id | → `rail_waybill.id` |
| container_id | → `rail_container.id`（能对到箱则填） |
| batch_id | → `shipment_batch.id` |
| ticket_no / box_no | 快照 |
| bound_at / unbound_at | 挂出、收回时间 |
| status | active / returned / lost_on_trip / cancelled |
| remark / created_at | |

**有效唯一：** `tarp_id` 在 `status=active` 时只能一条。

---

## 12. `tarpaulin_ledger` 篷布流水

一行 = 一次变动（只追加）。

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| tarp_id | → `tarpaulin.id`，必填 |
| action | register / bind / unbind / transfer / lose / scrap |
| occurred_at | |
| waybill_id | → `rail_waybill.id` |
| place_name / operator_name / note / created_at | |

---

## 13. `logistics_event` 收发流水

一行 = 一次收发动作（只追加）。

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| order_id | → `customer_order.id`，必填 |
| order_day_id | → `order_day.id` |
| event_type | 下单、发端装车、送到站、装火车、制票发出、在途、到站、收端装车、送到厂、签收、短少、货损、备注 |
| direction | outbound 发端 / inbound 收端 / internal 铁路 |
| occurred_at / place_name / weight_t | |
| batch_id / waybill_id / container_id / trip_id | 指向对应表，均可空 |
| ticket_no / box_no / plate_no | 快照 |
| operator_name / source_file / note / created_at | |

---

## 14. `ocr_import` 导入日志（可选）

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| source_file / imported_at / waybill_count / container_count / remark | |

无外键。

---

## 15. `cargo_owner` 货主

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| name | 货主名称，**唯一** |
| tax_id / contact_name / phone / address / status / remark / created_at | |

## 16. `shipping_order` 发货指令

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| order_id | → `customer_order.id`，必填 |
| cargo_owner_id | → `cargo_owner.id` |
| ship_no | 发货单号，**唯一** |
| cargo_name / origin_place / dest_place | |
| plan_weight_t | 本指令计划吨 |
| status | draft / confirmed / shipping / received / closed / cancelled |
| confirmed_at / remark / created_at / updated_at | |

## 17. `shipping_order_line` 发货日计划

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| shipping_order_id | → `shipping_order.id` |
| plan_date | 计划发运日 |
| plan_weight_t | 当天计划吨 |
| remark / created_at | |

**唯一：** 指令 + 日期。

## 18. `shipping_fulfillment` 发货实绩（一箱从发到收）

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| shipping_order_id | → `shipping_order.id` |
| shipping_order_line_id | → 当天计划行 |
| container_id / waybill_id | → 箱、运单 |
| weight_t | 本箱吨 |
| departed_at / received_at | 发出、签收时间 |
| status | planned / departed / in_transit / arrived / received / shortage / cancelled |
| created_at | |

**唯一：** `container_id` 非空时一个箱一条实绩。

## 19. `doc_record` 单证

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| order_id / shipping_order_id / waybill_id / trip_id | 可空外键 |
| doc_type | shipping_order / rail_waybill / highway_waybill / rail_invoice / vat_invoice / pod / other |
| doc_no / status / issued_at / file_path / remark / created_at | |

## 20. `fin_ar` 应收货主

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| cargo_owner_id / order_id / shipping_order_id | |
| amount / tax_amt / invoice_no / due_date | |
| status | draft / issued / partial / paid / void |
| remark / created_at | |

## 21. `fin_ap` 应付铁路/车队

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| vendor_type | railway / truck / handling / other |
| vendor_name / order_id / waybill_id / trip_id | |
| amount / tax_amt / invoice_no / due_date / status / remark / created_at | |

## 22. `fin_payment` 收付款

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| direction | in 收款 / out 付款 |
| amount / paid_at / party_name / method / ref_no / remark / created_at | |

## 23. `fin_match` 核销

| 字段 | 说明 |
|------|------|
| **id** | 主键 |
| payment_id | → `fin_payment.id`，必填 |
| ar_id / ap_id | 对应收或应付（填其中一个） |
| amount / matched_at / remark | |

---

## 外键一览

| 从表.字段 | 到表 |
|-----------|------|
| shipment_batch.order_id | customer_order |
| order_day.order_id | customer_order |
| rail_waybill.batch_id | shipment_batch |
| rail_waybill.order_id | customer_order |
| rail_container.waybill_id | rail_waybill |
| rail_container.batch_id | shipment_batch |
| truck_trip.batch_id | shipment_batch |
| truck_trip.order_id | customer_order |
| truck_trip.vehicle_id | truck_vehicle |
| truck_trip.driver_id | driver |
| container_truck.container_id | rail_container |
| container_truck.trip_id | truck_trip |
| customer_order.cargo_owner_id | cargo_owner |
| shipping_order.order_id | customer_order |
| shipping_order.cargo_owner_id | cargo_owner |
| shipping_order_line.shipping_order_id | shipping_order |
| shipping_fulfillment.shipping_order_id | shipping_order |
| shipping_fulfillment.shipping_order_line_id | shipping_order_line |
| shipping_fulfillment.container_id | rail_container |
| shipping_fulfillment.waybill_id | rail_waybill |
| rail_waybill.shipping_order_id | shipping_order |
| rail_container.shipping_order_id | shipping_order |
| logistics_event.shipping_order_id | shipping_order |
| doc_record.order_id | customer_order |
| doc_record.shipping_order_id | shipping_order |
| doc_record.waybill_id | rail_waybill |
| doc_record.trip_id | truck_trip |
| fin_ar.cargo_owner_id | cargo_owner |
| fin_ar.order_id | customer_order |
| fin_ar.shipping_order_id | shipping_order |
| fin_ap.order_id | customer_order |
| fin_ap.waybill_id | rail_waybill |
| fin_ap.trip_id | truck_trip |
| fin_match.payment_id | fin_payment |
| fin_match.ar_id | fin_ar |
| fin_match.ap_id | fin_ap |
| tarpaulin_use.tarp_id | tarpaulin |
| tarpaulin_use.waybill_id | rail_waybill |
| tarpaulin_use.container_id | rail_container |
| tarpaulin_use.batch_id | shipment_batch |
| tarpaulin_ledger.tarp_id | tarpaulin |
| tarpaulin_ledger.waybill_id | rail_waybill |
| logistics_event.order_id | customer_order |
| logistics_event.order_day_id | order_day |
| logistics_event.batch_id | shipment_batch |
| logistics_event.waybill_id | rail_waybill |
| logistics_event.container_id | rail_container |
| logistics_event.trip_id | truck_trip |

---

## 业务唯一键（除 id 外）

| 表 | 唯一 |
|----|------|
| customer_order | order_no |
| order_day | order_id + biz_date |
| shipment_batch | batch_no（非空时） |
| rail_waybill | ticket_no |
| rail_container | waybill_id + box_no |
| truck_vehicle | plate_no |
| cargo_owner | name |
| shipping_order | ship_no |
| shipping_order_line | 指令 + plan_date |
| shipping_fulfillment | container_id（非空时） |
| tarpaulin | tarp_no |
| container_truck | 有效时：箱+路段；趟次+箱 |
| tarpaulin_use | 有效时：一块布一条 |

---

## 最小集合

货主从发到收、多日、五流：**再加 cargo_owner、shipping_order、shipping_order_line、shipping_fulfillment、doc_record、fin_***。  
只做「大票 + 汽车两端」：**rail_waybill、rail_container、truck_trip、container_truck**。
