import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function FinancialOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">财务概览</h1>
        <p className="text-muted-foreground">运输财务统计分析</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总运费收入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥0</div>
            <p className="text-xs text-muted-foreground">累计运费总收入</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月收入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥0</div>
            <p className="text-xs text-muted-foreground">本月运费收入</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待付金额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥0</div>
            <p className="text-xs text-muted-foreground">应付给合作方金额</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均运费</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥0</div>
            <p className="text-xs text-muted-foreground">单票平均运费</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}