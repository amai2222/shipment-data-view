// --- 文件: src/components/ImportDataDialog.tsx ---

import { useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogisticsRecord } from "@/types";

interface ImportDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (data: Partial<LogisticsRecord>[]) => void;
}

export function ImportDataDialog({ isOpen, onClose, onConfirmImport }: ImportDataDialogProps) {
  const [importedData, setImportedData] = useState<Partial<LogisticsRecord>[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Partial<LogisticsRecord>>(worksheet);
        
        // 数据清洗和转换
        const cleanedData = json.map(row => ({
          project_name: row["项目名称"],
          license_plate: row["车牌号"],
          driver_name: row["司机姓名"],
          driver_phone: String(row["司机电话"]),
          payable_cost: Number(row["应付成本"]),
        }));

        setImportedData(cleanedData);
      } catch (err) {
        setError("文件解析失败，请确保文件格式和内容正确。");
        setImportedData([]);
      }
    };
    reader.onerror = () => {
        setError("读取文件时发生错误。");
        setImportedData([]);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirm = () => {
    if (importedData.length > 0) {
      onConfirmImport(importedData);
      handleClose();
    }
  };

  const handleClose = () => {
    setImportedData([]);
    setFileName("");
    setError("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>导入数据</DialogTitle>
          <DialogDescription>选择一个 Excel 文件进行批量导入。文件应包含 '项目名称', '车牌号', '司机姓名', '司机电话', '应付成本' 这些列。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input id="excel-file" type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
          {fileName && <p className="text-sm text-muted-foreground">已选择文件: {fileName}</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        {importedData.length > 0 && (
          <div className="max-h-[300px] overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目名称</TableHead>
                  <TableHead>车牌号</TableHead>
                  <TableHead>司机姓名</TableHead>
                  <TableHead>应付成本</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importedData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.project_name}</TableCell>
                    <TableCell>{row.license_plate}</TableCell>
                    <TableCell>{row.driver_name}</TableCell>
                    <TableCell>{row.payable_cost}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>取消</Button>
          <Button onClick={handleConfirm} disabled={importedData.length === 0 || !!error}>
            确认导入 {importedData.length > 0 ? `(${importedData.length}条)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
