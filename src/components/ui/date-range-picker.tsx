// 正确路径: src/components/ui/date-range-picker.tsx
// 描述: [最终交互优化版] 实现了极致简洁的交互逻辑，并修复了时区问题。

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

// [时区修复函数] 将本地时区的Date对象，转换为代表其UTC日期的新Date对象。
const toUTCDate = (date: Date): Date => {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

// [时区修复函数] 使用UTC年、月、日来格式化日期，忽略本地时区。
const formatInUTC = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function DateRangePicker({
  className,
  date: parentDate,
  setDate: setParentDate,
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  // 使用一个临时的本地状态来处理日历上的交互
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
    // 对于预设，直接应用时区修正并更新父组件
    setParentDate({ from: toUTCDate(fromDate), to: toUTCDate(today) });
    setOpen(false);
  };

  // ★★★ 这是最终的核心交互逻辑 ★★★
  const handleDateSelect = (range: DateRange | undefined) => {
    // 检查是否是第二次点击，并且点击的是同一个日期
    if (localDate?.from && !localDate.to && range?.from && range.to &&
        range.from.getTime() === range.to.getTime() &&
        localDate.from.getTime() === range.from.getTime()) {
      // 如果是，则清除选择并关闭
      setLocalDate(undefined);
      setParentDate(undefined);
      setOpen(false);
      return;
    }

    // 正常更新本地日期状态
    setLocalDate(range);

    // 如果范围选择完成，则应用时区修正，更新父组件并关闭
    if (range?.from && range.to) {
      setParentDate({ from: toUTCDate(range.from), to: toUTCDate(range.to) });
      setOpen(false);
    }
  };

  // 处理当用户只选了一个日期就关闭弹窗的情况
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) { // 当弹窗将要关闭时
      if (localDate?.from && !localDate.to) {
        // 将单个日期设为单日范围，并应用时区修正
        setParentDate({ from: toUTCDate(localDate.from), to: toUTCDate(localDate.from) });
      }
    }
    setOpen(isOpen);
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
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
              parentDate.to && formatInUTC(parentDate.from) !== formatInUTC(parentDate.to) ? (
                <>
                  {formatInUTC(parentDate.from)} - {formatInUTC(parentDate.to)}
                </>
              ) : (
                formatInUTC(parentDate.from)
              )
            ) : (
              <span>选择日期范围</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex" align="start">
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
            // ★★★ 去掉“今天”的蓝点高亮 ★★★
            modifiers={{ today: [] }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
