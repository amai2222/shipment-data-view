import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DailyTransportStats, Project } from "@/types";

interface TransportChartProps {
  data: DailyTransportStats[];
  project: Project | undefined;
  actualTransportTotal: number;
  returnsTotal: number;
}

export function TransportChart({
  data,
  project,
  actualTransportTotal,
  returnsTotal,
}: TransportChartProps) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>
          每日运输量统计 - {project?.name || '未知项目'} (负责人：{project?.manager || '未指定'}) (吨)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis 
                domain={[0, 'dataMax + 20']}
                tickFormatter={(value) => value.toString()}
              />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                formatter={(value, name) => {
                  const label = name === 'actualTransport' ? '有效运输量' : '退货量';
                  return [`${Number(value).toFixed(2)}`, label];
                }}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
              <Legend 
                formatter={(value) => {
                  if (value === 'actualTransport') {
                    return `有效运输量 (${actualTransportTotal.toFixed(1)}吨)`;
                  }
                  return `退货量 (${returnsTotal.toFixed(1)}吨)`;
                }}
                wrapperStyle={{ 
                  paddingTop: '20px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              />
              <Bar 
                dataKey="actualTransport" 
                fill="#4ade80" 
                name="actualTransport"
                radius={[2, 2, 0, 0]}
                label={{
                  position: 'top',
                  fontSize: 12,
                  fill: '#374151',
                  formatter: (value: number) => value.toFixed(1)
                }}
              />
              <Bar 
                dataKey="returns" 
                fill="#ef4444" 
                name="returns"
                radius={[2, 2, 0, 0]}
                label={{
                  position: 'top',
                  fontSize: 12,
                  fill: '#374151',
                  formatter: (value: number) => value.toFixed(1)
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

