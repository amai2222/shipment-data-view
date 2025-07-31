// --- 文件: src/lib/excelUtils.ts ---

import * as XLSX from "xlsx-js-style";
import { LogisticsRecord } from "@/types";

// 导出数据到 Excel
export const exportDataToExcel = (data: LogisticsRecord[], fileName: string) => {
    const header = [ "项目名称", "车牌号", "司机姓名", "司机电话", "应付成本", "创建时间" ];

    const dataForSheet = data.map(row => ({
        "项目名称": row.project_name,
        "车牌号": row.license_plate,
        "司机姓名": row.driver_name,
        "司机电话": row.driver_phone,
        "应付成本": row.payable_cost,
        "创建时间": new Date(row.created_at).toLocaleString(),
    }));

    const ws = XLSX.utils.json_to_sheet(dataForSheet, { header });

    // 设置列宽
    ws['!cols'] = [
        { wch: 20 }, // 项目名称
        { wch: 15 }, // 车牌号
        { wch: 15 }, // 司机姓名
        { wch: 15 }, // 司机电话
        { wch: 15 }, // 应付成本
        { wch: 20 }, // 创建时间
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "运单数据");
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

// 下载导入模板
export const downloadImportTemplate = () => {
    const header = [ "项目名称", "车牌号", "司机姓名", "司机电话", "应付成本" ];
    const templateData = [
        { "项目名称": "示例：上海-北京", "车牌号": "沪A12345", "司机姓名": "李师傅", "司机电话": "13912345678", "应付成本": 5000 },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData, { header });

    // 设置列宽
    ws['!cols'] = [
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
    ];
    
    // 设置表头样式
    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4F81BD" } } };
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1:E1');
    for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
        const cell_address = XLSX.utils.encode_cell({c:C, r:headerRange.s.r});
        if(!ws[cell_address]) continue;
        ws[cell_address].s = headerStyle;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "导入模板");
    XLSX.writeFile(wb, "运单导入模板.xlsx");
}
