import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon, Truck, Package, BarChartHorizontal, Wallet } from "lucide-react";
import { format } from 'date-fns';

interface DailyReport { 
  trip_count: number; 
  total_tonnage: number; 
  driver_receivable: number; 
  partner_payable: number; 
}

interface SummaryStats { 
  total_trips: number; 
  total_cost: number; 
  avg_cost: number; 
  total_tonnage: number; 
}

interface DailyReportCardsProps {
  dailyReport: DailyReport;
  summaryStats: SummaryStats;
  reportDate: Date;
  partnerName: string;
  unit: string;
}

const formatNumber = (val: number | null | undefined, unit: string = '') => 
  `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

export function DailyReportCards({
  dailyReport,
  summaryStats,
  reportDate,
  partnerName,
  unit,
}: DailyReportCardsProps) {
  return (
    <Card className="shadow-sm flex flex-col h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-lg">
          <CalendarIcon className="mr-2 h-5 w-5 text-orange-500"/>
          <span className="text-orange-500">日报与汇总</span>
          <span className="ml-1 text-base font-normal text-slate-600">
            ({format(reportDate, "yyyy-MM-dd")})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-4 gap-4 flex-grow">
        <Card className="flex flex-col justify-center items-center p-2">
          <p className="text-2xl font-bold text-slate-800">
            {formatNumber(dailyReport?.trip_count, '次')}
          </p>
          <p className="text-sm text-slate-500 mt-1">当日车次</p>
        </Card>
        <Card className="flex flex-col justify-center items-center p-2">
          <p className="text-2xl font-bold text-slate-800">
            {formatNumber(dailyReport?.total_tonnage, unit)}
          </p>
          <p className="text-sm text-slate-500 mt-1">当日运输量</p>
        </Card>
        <Card className="flex flex-col justify-center items-center p-2">
          <p className="text-2xl font-bold text-green-600">
            {formatNumber(dailyReport?.driver_receivable, '元')}
          </p>
          <p className="text-sm text-slate-500 mt-1">司机应收</p>
        </Card>
        <Card className="flex flex-col justify-center items-center p-2">
          <p className="text-2xl font-bold text-red-600">
            {formatNumber(dailyReport?.partner_payable, '元')}
          </p>
          <p className="text-sm text-slate-500 mt-1">{partnerName || '合作方'}应付</p>
        </Card>
        <Card className="flex flex-col justify-center items-center p-2">
          <p className="text-2xl font-bold text-slate-800">
            {formatNumber(summaryStats?.total_trips, '车')}
          </p>
          <div className="flex items-center text-sm text-slate-500 mt-1">
            <Truck className="h-4 w-4 mr-2"/>已发总车次
          </div>
        </Card>
        <Card className="flex flex-col justify-center items-center p-2">
          <p className="text-2xl font-bold text-slate-800">
            {formatNumber(summaryStats?.total_tonnage, unit)}
          </p>
          <div className="flex items-center text-sm text-slate-500 mt-1">
            <Package className="h-4 w-4 mr-2"/>已发总数量
          </div>
        </Card>
        <Card className="flex flex-col justify-center items-center p-2">
          <p className="text-2xl font-bold text-green-600">
            {formatNumber(summaryStats?.avg_cost, `元/${unit}`)}
          </p>
          <div className="flex items-center text-sm text-slate-500 mt-1">
            <BarChartHorizontal className="h-4 w-4 mr-2"/>平均单位成本
          </div>
        </Card>
        <Card className="flex flex-col justify-center items-center p-2">
          <p className="text-2xl font-bold text-red-600">
            {formatNumber(summaryStats?.total_cost, '元')}
          </p>
          <div className="flex items-center text-sm text-slate-500 mt-1">
            <Wallet className="h-4 w-4 mr-2"/>{partnerName || '合作方'}总应付
          </div>
        </Card>
      </CardContent>
    </Card>
  );
}

