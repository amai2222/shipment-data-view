import { useMemo, memo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis
} from 'recharts';
import type { TrendData } from '@/services/DashboardDataService';

// 图表配置接口
interface ChartConfig {
  margin?: { top: number; right: number; left: number; bottom: number };
  colors?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
}

// 优化的折线图组件
interface OptimizedLineChartProps {
  data: TrendData[];
  visibleLines?: {
    weight?: boolean;
    trips?: boolean;
    receivable?: boolean;
  };
  unitConfig?: {
    unit: string;
    billingTypeId: number;
  };
  config?: ChartConfig;
  onLegendClick?: (dataKey: string) => void;
}

export const OptimizedLineChart = memo<OptimizedLineChartProps>(({
  data,
  visibleLines = { weight: true, trips: true, receivable: true },
  unitConfig = { unit: '吨', billingTypeId: 1 },
  config = {},
  onLegendClick
}) => {
  // 缓存图表配置
  const chartConfig = useMemo(() => ({
    margin: config.margin || { top: 5, right: 40, left: 40, bottom: 5 },
    colors: {
      primary: config.colors?.primary || '#0d9488',
      secondary: config.colors?.secondary || '#4338ca',
      tertiary: config.colors?.tertiary || '#f59e0b',
      ...config.colors
    },
    showGrid: config.showGrid !== false,
    showLegend: config.showLegend !== false,
    showTooltip: config.showTooltip !== false
  }), [config]);

  // 缓存工具提示格式化函数
  const tooltipFormatter = useMemo(() => 
    (value: number, name: string) => [
      `${(value || 0).toLocaleString()} ${
        name === '车次' ? '车' : 
        name === '数量' ? unitConfig.unit : '元'
      }`,
      name
    ],
    [unitConfig.unit]
  );

  // 缓存图例格式化函数
  const legendFormatter = useMemo(() => 
    (value: string, entry: any) => {
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
    },
    [visibleLines]
  );

  // 缓存图表数据
  const memoizedData = useMemo(() => data, [JSON.stringify(data)]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart 
        data={memoizedData} 
        margin={chartConfig.margin}
      >
        {chartConfig.showGrid && <CartesianGrid strokeDasharray="3 3" />}
        
        <XAxis dataKey="date" />
        
        <YAxis 
          yAxisId="left-weight" 
          orientation="left" 
          stroke={chartConfig.colors.primary}
          label={{ 
            value: unitConfig.unit, 
            angle: -90, 
            position: 'insideLeft', 
            fill: chartConfig.colors.primary 
          }} 
        />
        
        <YAxis 
          yAxisId="middle-trips" 
          orientation="left" 
          stroke={chartConfig.colors.secondary}
          label={{ 
            value: '车次', 
            angle: -90, 
            position: 'insideLeft', 
            offset: -20, 
            fill: chartConfig.colors.secondary 
          }} 
        />
        
        <YAxis 
          yAxisId="right-cost" 
          orientation="right" 
          stroke={chartConfig.colors.tertiary}
          label={{ 
            value: '元', 
            angle: -90, 
            position: 'insideRight', 
            fill: chartConfig.colors.tertiary 
          }} 
        />
        
        {chartConfig.showTooltip && (
          <Tooltip formatter={tooltipFormatter} />
        )}
        
        {chartConfig.showLegend && onLegendClick && (
          <Legend 
            onClick={(e: any) => onLegendClick(e.dataKey as string)} 
            formatter={legendFormatter}
          />
        )}
        
        <Line 
          yAxisId="left-weight" 
          type="monotone" 
          dataKey="weight" 
          name="数量" 
          stroke={chartConfig.colors.primary} 
          strokeWidth={2} 
          hide={!visibleLines.weight} 
        />
        
        <Line 
          yAxisId="middle-trips" 
          type="monotone" 
          dataKey="trips" 
          name="车次" 
          stroke={chartConfig.colors.secondary} 
          strokeWidth={2} 
          hide={!visibleLines.trips} 
        />
        
        <Line 
          yAxisId="right-cost" 
          type="monotone" 
          dataKey="receivable" 
          name="应收总额" 
          stroke={chartConfig.colors.tertiary} 
          strokeWidth={2} 
          hide={!visibleLines.receivable} 
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

OptimizedLineChart.displayName = 'OptimizedLineChart';

// 优化的环形进度图组件
interface OptimizedCircularProgressChartProps {
  value: number;
  size?: number;
  color?: string;
  backgroundColor?: string;
  showPercentage?: boolean;
}

export const OptimizedCircularProgressChart = memo<OptimizedCircularProgressChartProps>(({
  value,
  size = 200,
  color = 'hsl(var(--primary))',
  backgroundColor = 'hsl(var(--muted))',
  showPercentage = true
}) => {
  // 缓存图表数据
  const chartData = useMemo(() => [
    { 
      name: 'progress', 
      value: Math.min(Math.max(value, 0), 100), // 确保值在 0-100 范围内
      fill: color 
    }
  ], [value, color]);

  // 缓存图表配置
  const chartConfig = useMemo(() => ({
    innerRadius: '60%',
    outerRadius: '85%',
    barSize: 10,
    startAngle: 90,
    endAngle: -270
  }), []);

  return (
    <div style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius={chartConfig.innerRadius}
          outerRadius={chartConfig.outerRadius}
          barSize={chartConfig.barSize}
          data={chartData}
          startAngle={chartConfig.startAngle}
          endAngle={chartConfig.endAngle}
        >
          <PolarAngleAxis 
            type="number" 
            domain={[0, 100]} 
            angleAxisId={0} 
            tick={false} 
          />
          
          <RadialBar 
            background={{ fill: backgroundColor }} 
            dataKey="value" 
            cornerRadius={6} 
            angleAxisId={0} 
          />
          
          {showPercentage && (
            <text 
              x="50%" 
              y="50%" 
              textAnchor="middle" 
              dominantBaseline="middle" 
              className="text-lg font-bold fill-primary"
            >
              {`${value.toFixed(1)}%`}
            </text>
          )}
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
});

OptimizedCircularProgressChart.displayName = 'OptimizedCircularProgressChart';

// 优化的简单折线图组件（用于概览页面）
interface OptimizedSimpleLineChartProps {
  data: TrendData[];
  dataKey: keyof TrendData;
  name: string;
  color?: string;
  height?: number;
}

export const OptimizedSimpleLineChart = memo<OptimizedSimpleLineChartProps>(({
  data,
  dataKey,
  name,
  color = 'hsl(var(--primary))',
  height = 300
}) => {
  // 缓存图表数据
  const memoizedData = useMemo(() => data, [JSON.stringify(data)]);

  // 缓存工具提示格式化函数
  const tooltipFormatter = useMemo(() => 
    (value: number) => [(value || 0).toLocaleString(), name],
    [name]
  );

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={memoizedData} 
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis label={{ value: '元', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={tooltipFormatter} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            name={name} 
            stroke={color} 
            strokeWidth={2} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

OptimizedSimpleLineChart.displayName = 'OptimizedSimpleLineChart';
