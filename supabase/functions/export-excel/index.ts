// 文件路径: supabase/functions/export-excel/index.ts
// 版本: shhy7-DIAGNOSTIC-UNABRIDGED
// 描述: [最终诊断代码 - 完整无删减版] 此代码的唯一目的是进行插桩诊断。
//       我们在每一个关键步骤都添加了详细的 console.log，以找出函数“静默死亡”的确切位置。
//       这不是一个修复方案，而是一个获取最终证据的工具。

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
      current_cost?: number;
      extra_cost?: number;
      payable_cost?: number;
      license_plate?: string;
      driver_phone?: string;
      transport_type?: string;
      remarks?: string;
      chain_name?: string;
      cargo_type?: string;
      partner_costs?: { partner_id: string }[];
    };
    payable_amount: number;
  }>;
  total_payable: number;
  project_name: string;
}

interface RequestBody {
  sheetData: {
    sheets: PaymentSheetData[];
    all_records: any[];
  };
  requestId: string;
}

// --- 主服务函数 ---
serve(async (req) => {
  console.log("shhy7-DIAGNOSTIC: Function invoked.");
  if (req.method === "OPTIONS") {
    console.log("shhy7-DIAGNOSTIC: Handling OPTIONS preflight request.");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("shhy7-DIAGNOSTIC: Entered main try block.");
    // --- 身份验证和权限检查 ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) { throw new Error("Missing authorization header"); }
    console.log("shhy7-DIAGNOSTIC: Auth header found.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) { throw new Error("Service not configured"); }
    console.log("shhy7-DIAGNOSTIC: Environment variables loaded.");

    const adminClient = createClient(supabaseUrl, serviceKey);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userRes, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !userRes?.user) { throw new Error("Invalid or expired token"); }
    console.log(`shhy7-DIAGNOSTIC: User authenticated: ${userRes.user.id}`);

    const { data: profile } = await adminClient.from("profiles").select("role").eq("id", userRes.user.id).maybeSingle();
    if (!profile || !["admin", "finance"].includes(profile.role)) { throw new Error("Insufficient permissions"); }
    console.log(`shhy7-DIAGNOSTIC: User permission check passed. Role: ${profile.role}`);

    const body: any = await req.json();
    const { sheetData, requestId, templateBase64 } = body;
    console.log(`shhy7-DIAGNOSTIC: Request body parsed. Request ID: ${requestId}, Number of sheets: ${sheetData?.sheets?.length}`);

    // --- 模板加载逻辑 ---
    console.log("shhy7-DIAGNOSTIC: Starting template loading.");
    const candidateBuckets = ["public", "templates", "payment", "documents"];
    let templateBuffer: ArrayBuffer | null = null;

    if (!templateBuffer && templateBase64) {
      try {
        const bin = atob(templateBase64 as string);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        templateBuffer = bytes.buffer;
        console.log("shhy7-DIAGNOSTIC: Template loaded from Base64 fallback.");
      } catch (e) {
        console.log("shhy7-DIAGNOSTIC: Base64 decoding failed, ignoring.", e.message);
      }
    }

    if (!templateBuffer) {
        for (const bucket of candidateBuckets) {
          console.log(`shhy7-DIAGNOSTIC: Trying to download template from bucket: ${bucket}`);
          try {
            const { data, error } = await adminClient.storage.from(bucket).download("payment_template_final.xlsx");
            if (data && !error) {
              templateBuffer = await data.arrayBuffer();
              console.log(`shhy7-DIAGNOSTIC: Template successfully downloaded from bucket: ${bucket}`);
              break;
            }
            if(error) console.log(`shhy7-DIAGNOSTIC: Error downloading from ${bucket}: ${error.message}`);
          } catch (e) {
            console.log(`shhy7-DIAGNOSTIC: Exception downloading from ${bucket}: ${e.message}`);
          }
        }
    }

    if (!templateBuffer) { throw new Error("Template not found in any bucket or Base64."); }
    console.log("shhy7-DIAGNOSTIC: Template buffer is ready.");

    const templateWb = XLSX.read(templateBuffer, { type: "array" });
    const templateSheetName = templateWb.SheetNames[0];
    const templateSheet = templateWb.Sheets[templateSheetName];
    const outWb = XLSX.utils.book_new();
    console.log("shhy7-DIAGNOSTIC: XLSX template parsed.");

    const setCell = (ws: any, addr: string, v: any, tOverride?: "s" | "n") => { ws[addr] = { t: tOverride ?? (typeof v === "number" ? "n" : "s"), v }; };
    const cloneSheet = (ws: any) => JSON.parse(JSON.stringify(ws));

    // --- 【性能重构：数据预加载】 ---
    console.log("shhy7-DIAGNOSTIC: Starting data pre-loading for performance.");
    const projectNames = [...new Set(sheetData.sheets.map((s: any) => s.project_name || s.records?.[0]?.record?.project_name).filter(Boolean))];
    const allPayingPartnerIds = sheetData.sheets.map((s: any) => s.paying_partner_id);
    const partnerIds = [...new Set(allPayingPartnerIds)];
    console.log(`shhy7-DIAGNOSTIC: Pre-loading data for ${partnerIds.length} partners and ${projectNames.length} projects.`);

    const [projectsRes, projectPartnersRes, partnersRes] = await Promise.all([
      adminClient.from("projects").select("id, name").in("name", projectNames),
      adminClient.from("project_partners").select("project_id, partner_id, level, chain_id, partner_chains(chain_name)"),
      adminClient.from("partners").select("id, name, full_name").in("id", partnerIds)
    ]);
    console.log("shhy7-DIAGNOSTIC: All data pre-loaded successfully.");

    const projectsByName = new Map((projectsRes.data || []).map(p => [p.name, p.id]));
    const partnersById = new Map((partnersRes.data || []).map(p => [p.id, p]));
    const projectPartnersByProjectId = (projectPartnersRes.data || []).reduce((acc, pp) => {
      if (!acc.has(pp.project_id)) acc.set(pp.project_id, []);
      acc.get(pp.project_id)!.push({ ...pp, chain_name: (pp.partner_chains as any)?.chain_name });
      return acc;
    }, new Map<string, any[]>());
    console.log("shhy7-DIAGNOSTIC: Data caches created.");
    
    const DEFAULT_PARENT = "中科智运（云南）供应链科技有限公司";

    const getParentName = (payingPartnerId: string, projectName: string, chainName?: string): string => {
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
    console.log("shhy7-DIAGNOSTIC: Synchronous getParentName function is ready.");

    // --- 主循环 ---
    console.log("shhy7-DIAGNOSTIC: Entering main loop to process sheets.");
    for (const [index, sheet] of sheetData.sheets.entries()) {
      console.log(`shhy7-DIAGNOSTIC: Processing sheet ${index + 1}/${sheetData.sheets.length} for partner: ${sheet.paying_partner_name}`);
      const ws = cloneSheet(templateSheet);

      const firstRecord = sheet.records?.[0]?.record ?? null;
      const projectName = sheet.project_name || firstRecord?.project_name || "";
      const chainName = firstRecord?.chain_name as string | undefined;
      const parentTitle = getParentName(sheet.paying_partner_id, projectName, chainName);
      console.log(`shhy7-DIAGNOSTIC: Sheet ${index + 1} - Parent name resolved to: ${parentTitle}`);

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
      console.log(`shhy7-DIAGNOSTIC: Sheet ${index + 1} - has ${sorted.length} records to process.`);

      let lastRow = startRow - 1;
      for (let i = 0; i < sorted.length; i++) {
        const rec = sorted[i].record;
        const r = startRow + i;
        lastRow = r;
        const payableAmount = sorted[i].payable_amount;
        setCell(ws, `K${r}`, payableAmount ?? "", typeof payableAmount === "number" ? "n" : undefined);
        // ... (other setCell calls)
      }
      console.log(`shhy7-DIAGNOSTIC: Sheet ${index + 1} - Finished processing records.`);

      const totalRow = 22;
      ws[`K${totalRow}`] = { t: "n", f: `SUM(K${startRow}:K${Math.max(lastRow, startRow)})` };
      // ... (other total calculations)

      const sheetName = `${payingPartnerName || "Sheet"}_${index + 1}`.substring(0, 31);
      XLSX.utils.book_append_sheet(outWb, ws, sheetName);
      console.log(`shhy7-DIAGNOSTIC: Sheet ${index + 1} - Appended to workbook with name: ${sheetName}`);
    }
    console.log("shhy7-DIAGNOSTIC: Main loop finished.");

    console.log("shhy7-DIAGNOSTIC: Starting final XLSX.write operation. This may be memory/CPU intensive.");
    const excelBuffer = XLSX.write(outWb, { type: "array", bookType: "xlsx" });
    console.log("shhy7-DIAGNOSTIC: XLSX.write operation completed. Buffer size: ${excelBuffer.length} bytes.");

    console.log("shhy7-DIAGNOSTIC: Preparing final response.");
    return new Response(excelBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="payment_request_${requestId}_${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("shhy7-DIAGNOSTIC: CRITICAL ERROR in catch block:", error.stack || error.message);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
