// 正确路径: src/components/ui/date-range-picker.tsx
// 描述: [交互与时区最终修复版] 修复了时区导致的日期偏差，并优化了交互逻辑。

"use client"

import * as React from "react"
import { format, subDays, subMonths, subYears } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
  disabled?: boolean;
}

/**
 * [时区修复函数] 将一个本地时区的Date对象，转换为一个代表其UTC日期的新Date对象。
 * 例如，对于中国时区的 "2025-08-24 00:00:00 GMT+0800"，
 * 它会返回一个代表 "2025-08-24 00:00:00 UTC" 的新Date对象。
 */
const toUTCDate = (date: Date): Date => {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

/**
 * [时区修复函数] 使用UTC年、月、日来格式化日期，忽略本地时区。
 */
const formatInUTC = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};


export function DateRangePicker({
  className,
  date: parentDate, // 从父组件接收的日期
  setDate: setParentDate, // 更新父组件日期的方法
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  // 使用一个临时的本地状态来处理日历上的交互，避免直接影响父组件
  const [localDate, setLocalDate] = React.useState<DateRange | undefined>(parentDate);

  // 当弹窗打开时，将父组件的日期同步到本地状态
  React.useEffect(() => {
    if (open) {
      setLocalDate(parentDate);
    }
  }, [open, parentDate]);


  const handlePresetClick = (range: "7d" | "1m" | "3m" | "6m" | "1y") => {
    const today = new Date();
    let fromDate: Date;
    switch (range) {
      case "7d": fromDate = subDays(today, 6); break;
      case "1m": fromDate = subMonths(today, 1); break;
      case "3m": fromDate = subMonths(today, 3); break;
      case "6m": fromDate = subMonths(today, 6); break;
      case "1y": fromDate = subYears(today, 1); break;
    }
    // 对于预设，直接更新父组件并关闭
    setParentDate({ from: fromDate, to: today });
    setOpen(false);
  };

  // 在日历上选择时，只更新本地状态
  const handleDateSelect = (range: DateRange | undefined) => {
    setLocalDate(range);
  };

  // 点击“应用”按钮时，才将本地选择的日期（经过时区修正）传递给父组件
  const handleApply = () => {
    let finalRange = localDate;

    // 如果只选了一个日期，则自动设为单日范围
    if (localDate?.from && !localDate.to) {
      finalRange = { from: localDate.from, to: localDate.from };
    }

    // ★★★ 核心时区修正 ★★★
    if (finalRange?.from) {
      const adjustedFrom = toUTCDate(finalRange.from);
      const adjustedTo = finalRange.to ? toUTCDate(finalRange.to) : undefined;
      setParentDate({ from: adjustedFrom, to: adjustedTo });
    } else {
      setParentDate(undefined);
    }
    
    setOpen(false);
  };
  
  const handleClear = () => {
    setLocalDate(undefined);
    setParentDate(undefined);
    setOpen(false);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !parentDate && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {parentDate?.from ? (
              parentDate.to ? (
                // ★★★ 使用UTC格式化函数来显示日期 ★★★
                formatInUTC(parentDate.from) === formatInUTC(parentDate.to) ? (
                  formatInUTC(parentDate.from)
                ) : (
                  <>
                    {formatInUTC(parentDate.from)} - {formatInUTC(parentDate.to)}
                  </>
                )
              ) : (
                formatInUTC(parentDate.from)
              )
            ) : (
              <span>选择日期范围</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col">
            <div className="flex">
              <div className="flex flex-col space-y-2 border-r p-4">
                <Button variant="ghost" className="justify-start" onClick={() => handlePresetClick("7d")}>最近一周</Button>
                <Button variant="ghost" className="justify-start" onClick={() => handlePresetClick("1m")}>最近一个月</Button>
                <Button variant="ghost" className="justify-start" onClick={() => handlePresetClick("3m")}>最近三个月</Button>
                <Button variant="ghost" className="justify-start" onClick={() => handlePresetClick("6m")}>最近六个月</Button>
                <Button variant="ghost" className="justify-start" onClick={() => handlePresetClick("1y")}>最近一年</Button>
              </div>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={localDate?.from}
                selected={localDate}
                onSelect={handleDateSelect}
                numberOfMonths={2}
                locale={zhCN}
              />
            </div>
            <div className="flex items-center justify-end gap-2 p-3 border-t">
              <Button variant="ghost" onClick={handleClear}>
                清除
              </Button>
              <Button onClick={handleApply}>
                应用
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
