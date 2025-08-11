// 文件路径: supabase/functions/export-excel/index.ts
// 版本: DFmhz-SHARED-ROW-FIX
// 描述: [最终生产级代码 - 终极共享行修复] 此代码最终、决定性地、无可辩驳地
//       修复了将合计区与备注区错误地放置在不同行的灾难性布局错误。
//       1. 【终极布局修复】合计区与备注区现在共享同一个动态行号 (totalRow)。
//       2. 【精准定位】备注被正确写入 B 列，合计被正确写入 J/K 列，二者在同一行。
//       3. 【完全适配】确保了最终输出的Excel文件完全匹配 DFmhz 指令的布局要求。

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- 主服务函数 ---
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- 身份验证和权限检查 (保持不变) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Service not configured");
    const adminClient = createClient(supabaseUrl, serviceKey);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userRes, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !userRes?.user) throw new Error("Invalid or expired token");
    const { data: profile } = await adminClient.from("profiles").select("role").eq("id", userRes.user.id).maybeSingle();
    if (!profile || !["admin", "finance"].includes(profile.role)) throw new Error("Insufficient permissions");

    const body = await req.json();
    const { sheetData, requestId, templateBase64 } = body;

    // --- 模板加载逻辑 (保持不变) ---
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

    // --- 数据预加载 (保持不变) ---
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

    // --- 主循环 ---
    for (const [index, sheet] of sheetData.sheets.entries()) {
      const firstRecord = sheet.records?.[0]?.record ?? null;
      const projectName = sheet.project_name || firstRecord?.project_name || "";
      const chainName = firstRecord?.chain_name;
      const projectId = projectsByName.get(projectName);
      const allPartnersInProject = projectId ? projectPartnersByProjectId.get(projectId) || [] : [];
      const partnersInChain = allPartnersInProject.filter((p: any) => !chainName || p.chain_name === chainName);
      const maxLevelInChain = partnersInChain.length > 0 ? Math.max(...partnersInChain.map((p: any) => p.level || 0)) : 0;
      const currentPartnerInfo = partnersInChain.find((p: any) => p.partner_id === sheet.paying_partner_id);

      if (currentPartnerInfo && currentPartnerInfo.level === maxLevelInChain) {
        continue;
      }

      const tempWb = XLSX.read(templateBuffer, { type: "array", cellStyles: true });
      const tempSheetName = tempWb.SheetNames[0];
      const ws = tempWb.Sheets[tempSheetName];

      const startRowToDelete = 4;
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:P50');
      for (let R = startRowToDelete - 1; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_address = XLSX.utils.encode_cell({c:C, r:R});
          if (ws[cell_address]) {
            delete ws[cell_address];
          }
        }
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
      const payingPartnerName = sheet.paying_partner_full_name || sheet.paying_partner_name || "";
      const bankAccount = sheet.paying_partner_bank_account || "";
      const bankName = sheet.paying_partner_bank_name || "";
      const branchName = sheet.paying_partner_branch_name || "";

      // 假设模板中已有静态表头，此处不再重复写入
      // setCell(ws, "A1", `${parentTitle}支付申请表`);
      // setCell(ws, "A2", `项目名称：${projectName}`);

      const startRow = 4;
      let currentRow = startRow;
      const sorted = (sheet.records || []).slice().sort((a: any, b: any) => String(a.record.auto_number || "").localeCompare(String(b.record.auto_number || "")));

      if (sorted.length > 0) {
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
          setCell(ws, `J${currentRow}`, rec.loading_weight ?? "", typeof rec.loading_weight === "number" ? "n" : undefined);
          const payableAmount = item.payable_amount;
          setCell(ws, `K${currentRow}`, payableAmount ?? "", typeof payableAmount === "number" ? "n" : undefined);
          setCell(ws, `L${currentRow}`, payingPartnerName);
          setCell(ws, `M${currentRow}`, bankAccount);
          setCell(ws, `N${currentRow}`, bankName);
          setCell(ws, `O${currentRow}`, branchName);
          currentRow++;
        }
      }

      // --- 【DFmhz 终极共享行修复】 ---
      // 1. 此行将同时用于合计和备注
      const totalRow = currentRow;

      // 2. 将备注写入 B 列的 totalRow
      setCell(ws, `B${totalRow}`, `备注：${sheet.footer?.remarks || ''}`);

      // 3. 将合计写入 J 和 K 列的 totalRow
      if (sorted.length > 0) {
        ws[`J${totalRow}`] = { t: "n", f: `SUM(J${startRow}:J${totalRow - 1})` };
        ws[`K${totalRow}`] = { t: "n", f: `SUM(K${startRow}:K${totalRow - 1})` };
      }
      
      // 4. 审批行基于 totalRow 计算，中间空一行
      const approverRow = totalRow + 2;
      setCell(ws, `A${approverRow}`, `信息专员签字：${sheet.footer?.info_specialist || ''}`);
      setCell(ws, `C${approverRow}`, `信息部审核签字：${sheet.footer?.info_audit || ''}`);
      setCell(ws, `E${approverRow}`, `业务负责人签字：${sheet.footer?.biz_lead || ''}`);
      setCell(ws, `G${approverRow}`, `复核审批人签字：${sheet.footer?.reviewer || ''}`);
      setCell(ws, `I${approverRow}`, `业务经理：${sheet.footer?.biz_manager || ''}`);
      setCell(ws, `K${approverRow}`, `业务总经理：${sheet.footer?.biz_general_manager || ''}`);
      setCell(ws, `M${approverRow}`, `财务部审核签字：${sheet.footer?.finance_audit || ''}`);

      const finalUsedRow = approverRow + 5; // 假设审批签字区占几行高度
      const newRange = XLSX.utils.decode_range(ws["!ref"] || "A1:P50");
      newRange.e.r = Math.max(newRange.e.r, finalUsedRow);
      ws["!ref"] = XLSX.utils.encode_range(newRange);

      const finalSheetName = `${payingPartnerName || "Sheet"}_${index + 1}`.substring(0, 31);
      XLSX.utils.book_append_sheet(finalWb, ws, finalSheetName);
    }

    // --- 文件上传和返回签名 URL (保持不变) ---
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
