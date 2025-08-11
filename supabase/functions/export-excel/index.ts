// 文件路径: supabase/functions/export-excel/index.ts
// 版本: v3XdG-TOP-LEVEL-FILTER-FIX
// 描述: [最终生产级代码 - 终极最高级别过滤修复] 此代码最终、决定性地、无可辩驳地
//       加入了核心业务规则：如果合作方是其所在供应链中的最高级别，则不为其生成付款申请单。
//       1. 【终极守卫逻辑】在主循环的最前端加入了 if 判断，识别最高级别合作方。
//       2. 【高效跳过】使用 continue 语句，高效地跳过不必要的处理，提升性能。
//       3. 【业务完整性】确保了生成的Excel文件完全符合系统的层级付款业务逻辑。

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Service not configured");
    const adminClient = createClient(supabaseUrl, serviceKey);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userRes, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !userRes?.user) throw new Error("Invalid or expired token");

    const body = await req.json();
    const { sheetData, requestId, templateBase64 } = body;

    let templateBuffer: ArrayBuffer | null = null;
    if (templateBase64) {
      try {
        const bin = atob(templateBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        templateBuffer = bytes.buffer;
      } catch (_) {}
    }
    if (!templateBuffer) {
      const { data, error } = await adminClient.storage.from("public").download("payment_template_final.xlsx");
      if (error) throw error;
      templateBuffer = await data.arrayBuffer();
    }
    if (!templateBuffer) throw new Error("Template not found.");

    const finalWb = XLSX.utils.book_new();
    const setCell = (ws: XLSX.WorkSheet, addr: string, v: any, tOverride?: XLSX.ExcelDataType) => {
      ws[addr] = { t: tOverride ?? (typeof v === "number" ? "n" : "s"), v };
    };
    
    const projectNames = [...new Set(sheetData.sheets.map((s: any) => s.project_name || s.records?.[0]?.record?.project_name).filter(Boolean))];
    const allPayingPartnerIds = sheetData.sheets.map((s: any) => s.paying_partner_id);
    const partnerIds = [...new Set(allPayingPartnerIds)];
    const [projectsRes, projectPartnersRes, partnersRes] = await Promise.all([
      adminClient.from("projects").select("id, name").in("name", projectNames),
      adminClient.from("project_partners").select("project_id, partner_id, level, chain_id, partner_chains(chain_name)"),
      adminClient.from("partners").select("id, name, full_name").in("id", partnerIds),
    ]);
    const projectsByName = new Map((projectsRes.data || []).map((p) => [p.name, p.id]));
    const partnersById = new Map((partnersRes.data || []).map((p) => [p.id, p]));
    const projectPartnersByProjectId = (projectPartnersRes.data || []).reduce((acc, pp) => {
      if (!acc.has(pp.project_id)) acc.set(pp.project_id, []);
      acc.get(pp.project_id).push({ ...pp, chain_name: pp.partner_chains?.chain_name });
      return acc;
    }, new Map());
    const DEFAULT_PARENT = "中科智运（云南）供应链科技有限公司";

    for (const [index, sheet] of sheetData.sheets.entries()) {
      const firstRecord = sheet.records?.[0]?.record ?? null;
      const projectName = sheet.project_name || firstRecord?.project_name || "";
      const chainName = firstRecord?.chain_name;
      const projectId = projectsByName.get(projectName);
      const allPartnersInProject = projectId ? projectPartnersByProjectId.get(projectId) || [] : [];
      const partnersInChain = allPartnersInProject.filter((p: any) => !chainName || p.chain_name === chainName);
      const maxLevelInChain = partnersInChain.length > 0 ? Math.max(...partnersInChain.map((p: any) => p.level || 0)) : 0;
      const currentPartnerInfo = partnersInChain.find((p: any) => p.partner_id === sheet.paying_partner_id);

      // --- 【v3XdG 终极最高级别过滤修复】 ---
      // 如果当前合作方是其所在供应链中的最高级别，则不为其生成付款申请单，直接跳过。
      if (currentPartnerInfo && currentPartnerInfo.level === maxLevelInChain) {
        continue;
      }

      const sorted = (sheet.records || []).slice().sort((a: any, b: any) => String(a.record.auto_number || "").localeCompare(String(b.record.auto_number || "")));
      
      const tempWb = XLSX.read(templateBuffer, { type: "array", cellStyles: true });
      const tempSheetName = tempWb.SheetNames[0];
      const ws = tempWb.Sheets[tempSheetName];

      const TEMPLATE_DATA_ROWS = 2;
      const numberOfRowsToInsert = Math.max(0, sorted.length - TEMPLATE_DATA_ROWS);

      if (numberOfRowsToInsert > 0) {
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:P50');
        const footerStartRow = 6;
        const footerStartIndex = footerStartRow - 1;

        for (let R = range.e.r; R >= footerStartIndex; --R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddr = XLSX.utils.encode_cell({r: R, c: C});
            const newCellAddr = XLSX.utils.encode_cell({r: R + numberOfRowsToInsert, c: C});
            if (ws[cellAddr]) {
              ws[newCellAddr] = ws[cellAddr];
              delete ws[cellAddr];
            }
          }
        }
        if (ws['!merges']) {
          ws['!merges'].forEach(merge => {
            if (merge.s.r >= footerStartIndex) {
              merge.s.r += numberOfRowsToInsert;
              merge.e.r += numberOfRowsToInsert;
            }
          });
        }
        range.e.r += numberOfRowsToInsert;
        ws['!ref'] = XLSX.utils.encode_range(range);
      }
      
      let parentTitle = DEFAULT_PARENT;
      if (currentPartnerInfo && currentPartnerInfo.level !== undefined) {
        if (currentPartnerInfo.level < maxLevelInChain - 1) {
          const parentLevel = currentPartnerInfo.level + 1;
          const parentInfo = partnersInChain.find((p: any) => p.level === parentLevel);
          if (parentInfo) {
            const parentPartner = partnersById.get(parentInfo.partner_id);
            parentTitle = parentPartner?.full_name || parentPartner?.name || DEFAULT_PARENT;
          }
        }
      }
      setCell(ws, "A1", `${parentTitle}支付申请表`);
      setCell(ws, "A2", `项目名称：${projectName}`);

      const startRow = 4;
      let currentRow = startRow;
      const payingPartnerName = sheet.paying_partner_full_name || sheet.paying_partner_name || "";
      const bankAccount = sheet.paying_partner_bank_account || "";
      const bankName = sheet.paying_partner_bank_name || "";
      const branchName = sheet.paying_partner_branch_name || "";

      for (const item of sorted) {
        const rec = item.record;
        setCell(ws, `A${currentRow}`, rec.auto_number || "");
        setCell(ws, `B${currentRow}`, rec.loading_date || "");
        setCell(ws, `C${currentRow}`, rec.unloading_date || "");
        setCell(ws, `D${currentRow}`, rec.loading_location || "");
        setCell(ws, `E${currentRow}`, rec.unloading_location || "");
        setCell(ws, `F${currentRow}`, rec.cargo_type || "普货");
        setCell(ws, `G${currentRow}`, rec.driver_name || "");
        setCell(ws, `H${currentRow}`, rec.driver_phone || "");
        setCell(ws, `I${currentRow}`, rec.license_plate || "");
        setCell(ws, `J${currentRow}`, rec.loading_weight ?? "", "n");
        setCell(ws, `K${currentRow}`, item.payable_amount ?? "", "n");
        setCell(ws, `L${currentRow}`, payingPartnerName);
        setCell(ws, `M${currentRow}`, bankAccount);
        setCell(ws, `N${currentRow}`, bankName);
        setCell(ws, `O${currentRow}`, branchName);
        currentRow++;
      }

      const totalAndRemarksRow = startRow + Math.max(sorted.length, TEMPLATE_DATA_ROWS);
      setCell(ws, `B${totalAndRemarksRow}`, `备注：${sheet.footer?.remarks || ''}`);
      if (sorted.length > 0) {
        ws[`J${totalAndRemarksRow}`] = { t: "n", f: `SUM(J${startRow}:J${totalAndRemarksRow - 1})` };
        ws[`K${totalAndRemarksRow}`] = { t: "n", f: `SUM(K${startRow}:K${totalAndRemarksRow - 1})` };
      }

      const approverRow = totalAndRemarksRow + 2;
      setCell(ws, `A${approverRow}`, `信息专员签字：${sheet.footer?.info_specialist || ''}`);
      setCell(ws, `C${approverRow}`, `信息部审核签字：${sheet.footer?.info_audit || ''}`);
      setCell(ws, `E${approverRow}`, `业务负责人签字：${sheet.footer?.biz_lead || ''}`);
      setCell(ws, `G${approverRow}`, `复核审批人签字：${sheet.footer?.reviewer || ''}`);
      setCell(ws, `I${approverRow}`, `业务经理：${sheet.footer?.biz_manager || ''}`);
      setCell(ws, `K${approverRow}`, `业务总经理：${sheet.footer?.biz_general_manager || ''}`);
      setCell(ws, `M${approverRow}`, `财务部审核签字：${sheet.footer?.finance_audit || ''}`);

      const finalSheetName = `${payingPartnerName || "Sheet"}_${index + 1}`.substring(0, 31);
      XLSX.utils.book_append_sheet(finalWb, ws, finalSheetName);
    }

    const excelBuffer = XLSX.write(finalWb, { type: "array", bookType: "xlsx" });
    const fileName = `payment_request_${requestId}_${new Date().toISOString().split("T")[0]}.xlsx`;
    const { error: uploadError } = await adminClient.storage.from("payment-requests").upload(fileName, excelBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
    if (uploadError) throw new Error(`Failed to upload Excel file to storage: ${uploadError.message}`);
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage.from("payment-requests").createSignedUrl(fileName, 60 * 5);
    if (signedUrlError) throw new Error(`Failed to create signed URL: ${signedUrlError.message}`);

    return new Response(JSON.stringify({ signedUrl: signedUrlData.signedUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("export-excel CRITICAL ERROR:", error.stack || error.message);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
