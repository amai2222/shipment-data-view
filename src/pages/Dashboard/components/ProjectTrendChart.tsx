import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts';

interface TrendData { 
  date: string; 
  trips: number; 
  weight: number; 
  receivable: number; 
}

interface VisibleLines {
  weight: boolean;
  trips: boolean;
  receivable: boolean;
}

interface ProjectTrendChartProps {
  data: TrendData[];
  projectName: string;
  unit: string;
  visibleLines: VisibleLines;
  onLegendClick: (dataKey: string) => void;
}

export function ProjectTrendChart({
  data,
  projectName,
  unit,
  visibleLines,
  onLegendClick,
}: ProjectTrendChartProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <TrendingUp className="mr-2 h-5 w-5 text-teal-500"/>
          <span className="text-teal-500">近7日进度</span>
          <span className="ml-1 text-base font-normal text-slate-600">
            ({projectName})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 40, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis 
              yAxisId="left-weight" 
              orientation="left" 
              stroke="#0d9488" 
              label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#0d9488' }} 
            />
            <YAxis 
              yAxisId="middle-trips" 
              orientation="left" 
              stroke="#4338ca" 
              label={{ value: '车次', angle: -90, position: 'insideLeft', offset: -20, fill: '#4338ca' }} 
            />
            <YAxis 
              yAxisId="right-cost" 
              orientation="right" 
              stroke="#f59e0b" 
              label={{ value: '元', angle: -90, position: 'insideRight', fill: '#f59e0b' }} 
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                `${(value || 0).toLocaleString()} ${name === '车次' ? '车' : name === '数量' ? unit : '元'}`, 
                name
              ]} 
            />
            <Legend 
              onClick={(e: any) => onLegendClick(e.dataKey as string)} 
              formatter={(value, entry: any) => {
                const dataKey = entry.dataKey as string;
                const isVisible = visibleLines[dataKey as keyof typeof visibleLines];
                return (
                  <span 
                    style={{ 
                      textDecoration: isVisible ? 'none' : 'line-through', 
                      color: isVisible ? '#333' : '#aaa' 
                    }}
                  >
                    {value}
                  </span>
                );
              }}
            />
            <Line 
              yAxisId="left-weight" 
              type="monotone" 
              dataKey="weight" 
              name="数量" 
              stroke="#0d9488" 
              strokeWidth={2} 
              hide={!visibleLines.weight} 
            />
            <Line 
              yAxisId="middle-trips" 
              type="monotone" 
              dataKey="trips" 
              name="车次" 
              stroke="#4338ca" 
              strokeWidth={2} 
              hide={!visibleLines.trips} 
            />
            <Line 
              yAxisId="right-cost" 
              type="monotone" 
              dataKey="receivable" 
              name="应收总额" 
              stroke="#f59e0b" 
              strokeWidth={2} 
              hide={!visibleLines.receivable} 
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

