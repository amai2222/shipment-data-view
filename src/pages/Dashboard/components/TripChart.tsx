import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Project } from "@/types";

interface DailyCountStats {
  date: string;
  count: number;
}

interface TripChartProps {
  data: DailyCountStats[];
  project: Project | undefined;
  totalTrips: number;
}

export function TripChart({ data, project, totalTrips }: TripChartProps) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>
          运输日报 - {project?.name || '未知项目'} (负责人：{project?.manager || '未指定'})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
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
                domain={[0, 'dataMax + 1']}
                tickFormatter={(value) => value.toString()}
              />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString('zh-CN')}
                formatter={(value) => [`${value} 次`, '运输次数']}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
              <Legend 
                formatter={() => `运输次数 (总计${totalTrips}次)`}
                wrapperStyle={{ 
                  paddingTop: '20px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#3b82f6' }}
                label={{
                  position: 'top',
                  fontSize: 12,
                  fill: '#374151',
                  formatter: (value: number) => value.toString()
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

