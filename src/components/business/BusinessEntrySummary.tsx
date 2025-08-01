interface SummaryData {
  totalLoadingWeight: number;
  totalUnloadingWeight: number;
  totalCurrentCost: number;
  totalExtraCost: number;
  totalDriverPayableCost: number;
  actualCount: number;
  returnCount: number;
}

interface BusinessEntrySummaryProps {
  summary: SummaryData;
}

export function BusinessEntrySummary({ summary }: BusinessEntrySummaryProps) {
  return (
    <div className="bg-muted/50 p-4 rounded-lg border">
      <h3 className="font-semibold mb-3">当前页合计</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-sm">
        <div className="text-center">
          <div className="text-muted-foreground">实际运输</div>
          <div className="font-semibold">{summary.actualCount} 单</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">退货</div>
          <div className="font-semibold">{summary.returnCount} 单</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">装货重量</div>
          <div className="font-semibold">{summary.totalLoadingWeight.toFixed(2)} 吨</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">卸货重量</div>
          <div className="font-semibold">{summary.totalUnloadingWeight.toFixed(2)} 吨</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">运费总额</div>
          <div className="font-semibold">¥{summary.totalCurrentCost.toFixed(2)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">额外费用</div>
          <div className="font-semibold">¥{summary.totalExtraCost.toFixed(2)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">司机应付</div>
          <div className="font-semibold">¥{summary.totalDriverPayableCost.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}