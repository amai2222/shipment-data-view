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

    // Build workbook
    const workbook = XLSX.utils.book_new();

    sheetData.sheets.forEach((sheet, index) => {
      const data: any[][] = [
        ["付款申请单"],
        [""],
        [`付款方: ${sheet.paying_partner_full_name || sheet.paying_partner_name}`],
        [`银行账户: ${sheet.paying_partner_bank_account || ""}`],
        [`开户行: ${sheet.paying_partner_bank_name || ""}`],
        [`支行网点: ${sheet.paying_partner_branch_name || ""}`],
        [`收款方: ${sheet.header_company_name}`],
        [`总金额: ¥${(sheet.total_payable || 0).toFixed(2)}`],
        [""],
        [
          "运单号",
          "项目名称",
          "司机姓名",
          "装货地点",
          "卸货地点",
          "装货日期",
          "卸货日期",
          "装货重量",
          "卸货重量",
          "运费",
          "额外费用",
          "应付金额",
          "车牌号",
          "司机电话",
          "运输类型",
          "货物类型",
          "备注",
        ],
      ];

      sheet.records.forEach(({ record, payable_amount }) => {
        data.push([
          record.auto_number || "",
          record.project_name || "",
          record.driver_name || "",
          record.loading_location || "",
          record.unloading_location || "",
          record.loading_date || "",
          record.unloading_date || "",
          record.loading_weight ?? "",
          record.unloading_weight ?? "",
          record.current_cost ?? 0,
          record.extra_cost ?? 0,
          payable_amount ?? 0,
          record.license_plate || "",
          record.driver_phone || "",
          record.transport_type || "",
          record.cargo_type || "",
          record.remarks || "",
        ]);
      });

      const sheetOut = XLSX.utils.aoa_to_sheet(data);
      sheetOut["!cols"] = [
        { wch: 15 },
        { wch: 20 },
        { wch: 10 },
        { wch: 20 },
        { wch: 20 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 20 },
      ];

      const sheetName = `${sheet.paying_partner_name}_${index + 1}`.substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, sheetOut, sheetName);
    });

    const excelBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

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
