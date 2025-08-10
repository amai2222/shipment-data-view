// 文件路径: supabase/functions/export-excel/index.ts
// 版本: ND0Yi-ULTIMATE-HIERARCHY-FIX
// 描述: [最终生产级代码 - 终极层级逻辑修复] 此代码最终、决定性地修复了所有已知问题。
//       1. 【层级感知终极修复】函数现在具备了“层级感知”能力。在每次循环中，它会动态计算当前项目
//          供应链中的最高层级，并与当前处理的合作方层级进行比较。
//       2. 【规则一实现】如果当前合作方是最高级，则会跳过循环，最终、决定性地、无可辩驳地实现了
//          “不为最高级合作方生成申请单”的业务规则。
//       3. 【规则二实现】如果当前合作方是第二高级，getParentName 函数会直接返回指定的公司抬头，
//          最终、决定性地、无可辩驳地实现了“表头覆盖”的业务规则。

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- 类型定义 (保持不变) ---
interface PaymentSheetData {
  paying_partner_id: string;
  paying_partner_name: string;
  paying_partner_full_name?: string;
  paying_partner_bank_account?: string;
  paying_partner_bank_name?: string;
  paying_partner_branch_name?: string;
  header_company_name: string;
  records: Array<{
    record: {
      id: string;
      auto_number: string;
      project_name: string;
      driver_name: string;
      loading_location: string;
      unloading_location: string;
      loading_date: string;
      unloading_date: string;
      loading_weight?: number;
      unloading_weight?: number;
      license_plate?: string;
      driver_phone?: string;
      chain_name?: string;
    };
    payable_amount: number;
  }>;
  total_payable: number;
  project_name: string;
  footer: { remarks: string; maker: string; auditor: string; approver: string; };
}

// --- 主服务函数 ---
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- 身份验证和权限检查 (保持不变) ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) { throw new Error("Missing authorization header"); }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) { throw new Error("Service not configured"); }
    const adminClient = createClient(supabaseUrl, serviceKey);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userRes, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !userRes?.user) { throw new Error("Invalid or expired token"); }
    const { data: profile } = await adminClient.from("profiles").select("role").eq("id", userRes.user.id).maybeSingle();
    if (!profile || !["admin", "finance"].includes(profile.role)) { throw new Error("Insufficient permissions"); }

    const body: any = await req.json();
    const { sheetData, requestId, templateBase64 } = body;

    // --- 模板加载逻辑 (保持不变) ---
    let templateBuffer: ArrayBuffer | null = null;
    if (templateBase64) {
      try {
        const bin = atob(templateBase64 as string);
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
    if (!templateBuffer) { throw new Error("Template not found."); }

    const finalWb = XLSX.utils.book_new();
    const setCell = (ws: any, addr: string, v: any, tOverride?: "s" | "n") => { ws[addr] = { t: tOverride ?? (typeof v === "number" ? "n" : "s"), v }; };

    // --- 数据预加载 (保持不变) ---
    const projectNames = [...new Set(sheetData.sheets.map((s: any) => s.project_name || s.records?.[0]?.record?.project_name).filter(Boolean))];
    const allPayingPartnerIds = sheetData.sheets.map((s: any) => s.paying_partner_id);
    const partnerIds = [...new Set(allPayingPartnerIds)];
    const [projectsRes, projectPartnersRes, partnersRes] = await Promise.all([
      adminClient.from("projects").select("id, name").in("name", projectNames),
      adminClient.from("project_partners").select("project_id, partner_id, level, chain_id, partner_chains(chain_name)"),
      adminClient.from("partners").select("id, name, full_name").in("id", partnerIds)
    ]);
    const projectsByName = new Map((projectsRes.data || []).map(p => [p.name, p.id]));
    const partnersById = new Map((partnersRes.data || []).map(p => [p.id, p]));
    const projectPartnersByProjectId = (projectPartnersRes.data || []).reduce((acc, pp) => {
      if (!acc.has(pp.project_id)) acc.set(pp.project_id, []);
      acc.get(pp.project_id)!.push({ ...pp, chain_name: (pp.partner_chains as any)?.chain_name });
      return acc;
    }, new Map<string, any[]>());
    
    const DEFAULT_PARENT = "中科智运（云南）供应链科技有限公司";

    // --- 【ND0Yi 终极逻辑修复 2/2】重构 getParentName 函数以接收层级信息 ---
    const getParentName = (
      payingPartnerId: string, 
      projectName: string, 
      chainName: string | undefined,
      currentLevel: number | undefined,
      maxLevel: number | undefined
    ): string => {
      // 如果当前合作方是第二高级别，则直接返回指定的公司抬头
      if (currentLevel !== undefined && maxLevel !== undefined && currentLevel === maxLevel - 1) {
        return DEFAULT_PARENT;
      }

      // 否则，执行原有的查找上一级的逻辑
      const projectId = projectsByName.get(projectName);
      if (!projectId) return DEFAULT_PARENT;
      const pps = projectPartnersByProjectId.get(projectId);
      if (!pps || pps.length === 0) return DEFAULT_PARENT;
      
      let current = pps.find(pp => pp.partner_id === payingPartnerId && (!chainName || pp.chain_name === chainName));
      if (!current) current = pps.find(pp => pp.partner_id === payingPartnerId);
      if (!current) return DEFAULT_PARENT;

      const nextLevel = (current.level || 0) + 1;
      const parentRow = pps.find(pp => pp.chain_id === current.chain_id && pp.level === nextLevel);
      if (!parentRow) return DEFAULT_PARENT;
      
      const parentPartner = partnersById.get(parentRow.partner_id);
      return parentPartner?.full_name || parentPartner?.name || DEFAULT_PARENT;
    };

    // --- 主循环 ---
    for (const [index, sheet] of sheetData.sheets.entries()) {
      const firstRecord = sheet.records?.[0]?.record ?? null;
      const projectName = sheet.project_name || firstRecord?.project_name || "";
      const chainName = firstRecord?.chain_name as string | undefined;
      
      // --- 【ND0Yi 终极逻辑修复 1/2】在循环开始时，动态计算层级信息 ---
      const projectId = projectsByName.get(projectName);
      const allPartnersInProject = projectId ? projectPartnersByProjectId.get(projectId) || [] : [];
      const partnersInChain = allPartnersInProject.filter(p => !chainName || p.chain_name === chainName);
      
      const maxLevelInChain = partnersInChain.length > 0 
        ? Math.max(...partnersInChain.map(p => p.level || 0))
        : 0;
        
      const currentPartnerInfo = partnersInChain.find(p => p.partner_id === sheet.paying_partner_id);

      // 如果当前合作方是最高级，则跳过本次循环，不为其生成申请单
      if (currentPartnerInfo && currentPartnerInfo.level === maxLevelInChain) {
        continue;
      }

      const tempWb = XLSX.read(templateBuffer, { type: "array", cellStyles: true });
      const tempSheetName = tempWb.SheetNames[0];
      const ws = tempWb.Sheets[tempSheetName];

      // 将层级信息传递给 getParentName 函数
      const parentTitle = getParentName(sheet.paying_partner_id, projectName, chainName, currentPartnerInfo?.level, maxLevelInChain);

      const payingPartnerName = (sheet as any).paying_partner_full_name || (sheet as any).paying_partner_name || "";
      const bankAccount = (sheet as any).paying_partner_bank_account || "";
      const bankName = (sheet as any).paying_partner_bank_name || "";
      const branchName = (sheet as any).paying_partner_branch_name || "";

      setCell(ws, "A1", `${parentTitle}支付申请表`);
      setCell(ws, "A2", `项目名称：${projectName}`);
      setCell(ws, "G2", `申请时间：${new Date().toISOString().split("T")[0]}`);
      setCell(ws, "L2", `申请编号：${requestId}`);

      const startRow = 4;
      const sorted = (sheet.records || []).slice().sort((a: any, b: any) => String(a.record.auto_number || "").localeCompare(String(b.record.auto_number || "")));

      let lastRow = startRow - 1;
      if (sorted.length > 0) {
        for (let i = 0; i < sorted.length; i++) {
          const rec = sorted[i].record;
          const r = startRow + i;
          lastRow = r;
          
          setCell(ws, `A${r}`, rec.auto_number || "");
          setCell(ws, `B${r}`, rec.loading_date || "");
          setCell(ws, `C${r}`, rec.unloading_date || "");
          setCell(ws, `D${r}`, rec.loading_location || "");
          setCell(ws, `E${r}`, rec.unloading_location || "");
          setCell(ws, `F${r}`, "普货");
          setCell(ws, `G${r}`, rec.driver_name || "");
          setCell(ws, `H${r}`, rec.driver_phone || "");
          setCell(ws, `I${r}`, rec.license_plate || "");
          setCell(ws, `J${r}`, rec.loading_weight ?? "", typeof rec.loading_weight === "number" ? "n" : undefined);
          const payableAmount = sorted[i].payable_amount;
          setCell(ws, `K${r}`, payableAmount ?? "", typeof payableAmount === "number" ? "n" : undefined);
          setCell(ws, `L${r}`, payingPartnerName);
          setCell(ws, `M${r}`, bankAccount);
          setCell(ws, `N${r}`, bankName);
          setCell(ws, `O${r}`, branchName);
        }
      }

      const totalRow = lastRow + 1;
      ws[`J${totalRow}`] = { t: "n", f: `SUM(J${startRow}:J${lastRow})` };
      setCell(ws, `K${totalRow}`, sheet.total_payable ?? 0, "n");

      const footerRow = totalRow + 1;
      setCell(ws, `B${footerRow}`, `备注：${sheet.footer?.remarks || ''}`);
      setCell(ws, `D${footerRow}`, `制表人：${sheet.footer?.maker || ''}`);
      setCell(ws, `G${footerRow}`, `财务审核：${sheet.footer?.auditor || ''}`);
      setCell(ws, `L${footerRow}`, `总经理审批：${sheet.footer?.approver || ''}`);

      const finalUsedRow = footerRow + 1;
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:P50");
      range.e.r = Math.max(range.e.r, finalUsedRow);
      ws["!ref"] = XLSX.utils.encode_range(range);

      const finalSheetName = `${payingPartnerName || "Sheet"}_${index + 1}`.substring(0, 31);
      XLSX.utils.book_append_sheet(finalWb, ws, finalSheetName);
    }

    const excelBuffer = XLSX.write(finalWb, { type: "array", bookType: "xlsx" });
    const fileName = `payment_request_${requestId}_${new Date().toISOString().split("T")[0]}.xlsx`;
    const { error: uploadError } = await adminClient.storage.from("payment-requests").upload(fileName, excelBuffer, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", upsert: true });
    if (uploadError) { throw new Error(`Failed to upload Excel file to storage: ${uploadError.message}`); }
    const { data: signedUrlData, error: signedUrlError } = await adminClient.storage.from("payment-requests").createSignedUrl(fileName, 60 * 5);
    if (signedUrlError) { throw new Error(`Failed to create signed URL: ${signedUrlError.message}`); }

    return new Response(JSON.stringify({ signedUrl: signedUrlData.signedUrl }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("export-excel CRITICAL ERROR:", error.stack || error.message);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
