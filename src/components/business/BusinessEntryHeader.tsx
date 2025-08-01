import { Button } from "@/components/ui/button";
import { Download, FileDown, FileUp, PlusCircle } from "lucide-react";

interface BusinessEntryHeaderProps {
  onAddNew: () => void;
  onImport: () => void;
  onExport: () => void;
  onTemplateDownload: () => void;
}

export function BusinessEntryHeader({
  onAddNew,
  onImport,
  onExport,
  onTemplateDownload
}: BusinessEntryHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">运单管理</h1>
        <p className="text-muted-foreground">管理物流运单记录</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <Button onClick={onAddNew} className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          新增运单
        </Button>
        <Button onClick={onImport} variant="outline" className="flex items-center gap-2">
          <FileUp className="h-4 w-4" />
          导入数据
        </Button>
        <Button onClick={onExport} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          导出Excel
        </Button>
        <Button onClick={onTemplateDownload} variant="outline" className="flex items-center gap-2">
          <FileDown className="h-4 w-4" />
          下载模板
        </Button>
      </div>
    </div>
  );
}