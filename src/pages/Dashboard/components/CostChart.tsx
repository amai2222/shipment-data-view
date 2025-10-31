import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DailyCostStats, Project } from "@/types";

interface CostChartProps {
  data: DailyCostStats[];
  project: Project | undefined;
  totalCostSum: number;
}

export function CostChart({ data, project, totalCostSum }: CostChartProps) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>
          每日运输费用分析 - {project?.name || '未知项目'} (负责人：{project?.manager || '未指定'}) (元)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
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
                domain={[0, 'dataMax + 100']}
                tickFormatter={(value) => value.toString()}
              />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                formatter={(value) => [`¥${Number(value).toFixed(2)}`, '总费用']}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
              <Legend 
                formatter={() => `总费用 (¥${totalCostSum.toFixed(2)})`}
                wrapperStyle={{ 
                  paddingTop: '20px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              />
              <Bar 
                dataKey="totalCost" 
                fill="#f59e0b" 
                radius={[2, 2, 0, 0]}
                label={{
                  position: 'top',
                  fontSize: 12,
                  fill: '#374151',
                  formatter: (value: number) => `¥${value.toFixed(0)}`
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

