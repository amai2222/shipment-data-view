import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userRes, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only admin/finance can export
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userRes.user.id)
      .maybeSingle();

    if (!profile || !["admin", "finance"].includes(profile.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sheetData, requestId }: RequestBody = await req.json();

    // Build workbook from storage template and fill per-partner sheets
    // 1) Load template file from Supabase Storage
    const candidateBuckets = ["public", "templates", "payment", "documents"];
    let templateBuffer: ArrayBuffer | null = null;

    for (const bucket of candidateBuckets) {
      try {
        const { data, error } = await adminClient.storage
          .from(bucket)
          .download("payment_template_final.xlsx");
        if (data && !error) {
          templateBuffer = await data.arrayBuffer();
          break;
        }
      } catch (_) {
        // ignore and try next bucket
      }
    }

    if (!templateBuffer) {
      return new Response(
        JSON.stringify({
          error:
            "Template not found. Please upload payment_template_final.xlsx to a Storage bucket (e.g. 'public').",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const templateWb = XLSX.read(templateBuffer, { type: "array" });
    const templateSheetName = templateWb.SheetNames[0];
    const templateSheet = templateWb.Sheets[templateSheetName];

    const outWb = XLSX.utils.book_new();

    // Helpers
    const setCell = (ws: any, addr: string, v: any, tOverride?: "s" | "n") => {
      const t = tOverride ?? (typeof v === "number" ? "n" : "s");
      ws[addr] = { t, v };
    };

    const cloneSheet = (ws: any) => JSON.parse(JSON.stringify(ws));

    const parentNameCache = new Map<string, string>();
    const DEFAULT_PARENT = "中科智运（云南）供应链科技有限公司";

    const getParentName = async (
      payingPartnerId: string,
      projectName: string,
      chainName?: string
    ): Promise<string> => {
      try {
        const cacheKey = `${payingPartnerId}|${projectName}|${chainName || ""}`;
        if (parentNameCache.has(cacheKey)) return parentNameCache.get(cacheKey)!;

        const { data: proj } = await adminClient
          .from("projects")
          .select("id")
          .eq("name", projectName)
          .maybeSingle();
        if (!proj?.id) {
          parentNameCache.set(cacheKey, DEFAULT_PARENT);
          return DEFAULT_PARENT;
        }

        let chainId: string | null = null;
        if (chainName) {
          const { data: chain } = await adminClient
            .from("partner_chains")
            .select("id")
            .eq("project_id", proj.id)
            .eq("chain_name", chainName)
            .maybeSingle();
          chainId = chain?.id ?? null;
        }

        const { data: pps } = await adminClient
          .from("project_partners")
          .select("partner_id, level, chain_id")
          .eq("project_id", proj.id)
          .order("level", { ascending: true });
        if (!pps || pps.length === 0) {
          parentNameCache.set(cacheKey, DEFAULT_PARENT);
          return DEFAULT_PARENT;
        }

        let current = pps.find(
          (pp: any) =>
            pp.partner_id === payingPartnerId && (!chainId || pp.chain_id === chainId)
        );
        if (!current) {
          current = pps.find((pp: any) => pp.partner_id === payingPartnerId);
        }
        if (!current) {
          parentNameCache.set(cacheKey, DEFAULT_PARENT);
          return DEFAULT_PARENT;
        }

        const nextLevel = (current.level || 0) + 1;
        const parentRow = pps.find(
          (pp: any) => pp.chain_id === current.chain_id && pp.level === nextLevel
        );
        if (!parentRow) {
          parentNameCache.set(cacheKey, DEFAULT_PARENT);
          return DEFAULT_PARENT;
        }

        const { data: parentPartner } = await adminClient
          .from("partners")
          .select("full_name, name")
          .eq("id", parentRow.partner_id)
          .maybeSingle();
        const parentName = parentPartner?.full_name || parentPartner?.name || DEFAULT_PARENT;
        parentNameCache.set(cacheKey, parentName);
        return parentName;
      } catch (_err) {
        return DEFAULT_PARENT;
      }
    };

    for (const [index, sheet] of sheetData.sheets.entries()) {
      const ws = cloneSheet(templateSheet);

      const firstRecord = sheet.records?.[0]?.record ?? null;
      const projectName = sheet.project_name || firstRecord?.project_name || "";
      const chainName = firstRecord?.chain_name as string | undefined;

      const parentTitle = await getParentName(
        sheet.paying_partner_id,
        projectName,
        chainName
      );

      const payingPartnerName =
        (sheet as any).paying_partner_full_name ||
        (sheet as any).paying_partner_name ||
        "";
      const bankAccount = (sheet as any).paying_partner_bank_account || "";
      const bankName = (sheet as any).paying_partner_bank_name || "";
      const branchName = (sheet as any).paying_partner_branch_name || "";

      // Header cells
      setCell(ws, "A1", `${parentTitle}支付申请表`);
      setCell(ws, "A2", `项目名称：${projectName}`);
      setCell(ws, "G2", `申请时间：${new Date().toISOString().split("T")[0]}`);
      setCell(ws, "L2", `申请编号：${requestId}`);

      // Data rows start at A4, ordered by 运单号 (auto_number) ASC
      const startRow = 4;
      const sorted = (sheet.records || [])
        .slice()
        .sort((a: any, b: any) =>
          String(a.record.auto_number || "").localeCompare(String(b.record.auto_number || ""))
        );

      let lastRow = startRow - 1;
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
        setCell(ws, `K${r}`, rec.payable_cost ?? "", typeof rec.payable_cost === "number" ? "n" : undefined);
        setCell(ws, `L${r}`, (sheet as any).paying_partner_name || payingPartnerName);
        setCell(ws, `M${r}`, bankAccount);
        setCell(ws, `N${r}`, bankName);
        setCell(ws, `O${r}`, branchName);
      }

      // Totals: keep row 23 fixed, so place sums in row 22
      const totalRow = 22;
      const sumStart = startRow;
      const sumEnd = Math.max(lastRow, startRow);
      ws[`J${totalRow}`] = { t: "n", f: `SUM(J${sumStart}:J${sumEnd})` };
      ws[`K${totalRow}`] = { t: "n", f: `SUM(K${sumStart}:K${sumEnd})` };

      // Ensure !ref is large enough
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1:O50");
      range.e.r = Math.max(range.e.r, Math.max(totalRow, lastRow));
      range.e.c = Math.max(range.e.c, 14); // column O (0-indexed 14)
      ws["!ref"] = XLSX.utils.encode_range(range);

      const sheetName = `${(sheet as any).paying_partner_name || payingPartnerName || "Sheet"}_${
        index + 1
      }`.substring(0, 31);
      XLSX.utils.book_append_sheet(outWb, ws, sheetName);
    }

    const excelBuffer = XLSX.write(outWb, { type: "array", bookType: "xlsx" });

    return new Response(excelBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="payment_request_${requestId}_${new Date()
          .toISOString()
          .split("T")[0]}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("export-excel error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
