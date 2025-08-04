// 文件路径: src/pages/payment-request.tsx
// [gmxWO Debug Step 2] 结构性测试

// --- 导入所有UI组件 ---
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Loader2, RefreshCw, Search, FileSpreadsheet, Save } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";

// --- 渲染一个不包含任何逻辑的静态骨架 ---
export default function PaymentRequest() {
  return (
    <div className="space-y-6" style={{ padding: '20px' }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">合作方付款申请</h1>
          <p className="text-muted-foreground">向合作方申请支付司机运费。</p>
        </div>
        <div className="flex gap-2">
          {/* 这是我们最终要找的按钮！ */}
          <Button variant="default">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            一键申请付款 (0)
          </Button>
          <Button variant="destructive">
            <RefreshCw className="mr-2 h-4 w-4" />
            重算费用 (0)
          </Button>
        </div>
      </div>

      <Card className="border-muted/40">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5 min-w-[140px]">
              <Label>项目</Label>
              <Select>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="选择项目" /></SelectTrigger>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>日期范围</Label>
              {/* 简单显示一个按钮代替复杂的DateRangePicker */}
              <Button variant="outline" className="h-9">选择日期</Button>
            </div>
            <Button size="sm" className="h-9 px-3 text-sm">
              <Search className="mr-2 h-4 w-4"/>搜索
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>运单财务明细</CardTitle>
        </CardHeader>
        <CardContent>
          <p>数据加载区域...</p>
        </CardContent>
      </Card>
    </div>
  );
}
