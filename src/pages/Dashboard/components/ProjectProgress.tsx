import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Target, Calendar as CalendarIcon } from "lucide-react";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis
} from 'recharts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ProjectDetails { 
  id: string; 
  name: string; 
  partner_name: string; 
}

interface UnitConfig {
  unit: string;
  progressCompleted: number;
  progressPlanned: number;
}

interface ProjectProgressProps {
  projectId: string | undefined;
  selectedProject: ProjectDetails | undefined;
  allProjects: ProjectDetails[];
  reportDate: Date;
  setReportDate: (date: Date) => void;
  onProjectChange: (projectId: string) => void;
  unitConfig: UnitConfig;
  progressPercentage: number;
}

const formatNumber = (val: number | null | undefined, unit: string = '') => 
  `${(val || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}${unit ? ' ' + unit : ''}`;

const CircularProgressChart = ({ value }: { value: number }) => {
  const data = [{ name: 'progress', value: value, fill: 'hsl(var(--primary))' }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="85%" barSize={10} data={data} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: 'hsl(var(--muted))' }} dataKey="value" cornerRadius={6} angleAxisId={0} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-lg font-bold fill-primary">
          {`${value.toFixed(1)}%`}
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
};

export function ProjectProgress({
  projectId,
  selectedProject,
  allProjects,
  reportDate,
  setReportDate,
  onProjectChange,
  unitConfig,
  progressPercentage,
}: ProjectProgressProps) {
  return (
    <Card className="shadow-sm flex flex-col h-full">
      <CardHeader className="flex flex-row justify-between items-center space-x-4">
        <div className="flex-shrink-0">
          <CardTitle className="flex items-center text-lg whitespace-nowrap">
            <Target className="mr-2 h-5 w-5 text-blue-500"/>
            <span className="text-blue-500">项目进度</span>
            <span className="ml-1 text-base font-normal text-slate-600">
              ({selectedProject?.name})
            </span>
          </CardTitle>
          <p className="text-sm text-slate-500 pt-1">{selectedProject?.partner_name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Select value={projectId || ''} onValueChange={onProjectChange}>
            <SelectTrigger className="w-auto min-w-[150px] bg-white text-slate-900 border-slate-300">
              <SelectValue placeholder="请选择项目..." />
            </SelectTrigger>
            <SelectContent>
              {allProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={cn(
                  "w-auto min-w-[130px] justify-start text-left font-normal bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900", 
                  !reportDate && "text-slate-500"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {reportDate ? format(reportDate, "yyyy-MM-dd") : <span>选择日期</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarComponent 
                mode="single" 
                selected={reportDate} 
                onSelect={(date) => date && setReportDate(date)} 
                initialFocus 
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-center items-center p-4 space-y-4">
        <div className="flex justify-between text-sm text-slate-600 w-full">
          <span>进度 ({unitConfig.unit})</span>
          <span className="font-semibold">{progressPercentage.toFixed(1)}%</span>
        </div>
        <div className="w-full max-w-[200px] aspect-square">
          <CircularProgressChart value={progressPercentage} />
        </div>
        <div className="w-full">
          <Progress value={progressPercentage} />
          <p className="text-sm font-bold text-center text-slate-600 mt-2">
            {formatNumber(unitConfig.progressCompleted, unitConfig.unit)} / {formatNumber(unitConfig.progressPlanned, unitConfig.unit)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

