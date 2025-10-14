// 正确路径: src/components/ui/date-range-picker.tsx
// 描述: [最终交互优化版] 实现了极致简洁的交互逻辑，并修复了时区问题。
// 新增逻辑: 用户通过两次点击同一个日期，即可完成单日范围的选择。

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

  // 确保当父组件日期为空时，本地状态也保持为空
  React.useEffect(() => {
    if (!parentDate || (!parentDate.from && !parentDate.to)) {
      setLocalDate(undefined);
    }
  }, [parentDate]);

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

  // ★★★ 交互逻辑优化 ★★★
  // 移除了“二次点击同一天则清空”的逻辑，使其变为“确认选择”
  const handleDateSelect = (range: DateRange | undefined) => {
    // 步骤 1: 始终使用传入的 range 更新本地状态，以确保日历UI实时响应用户的点击
    setLocalDate(range);

    // 步骤 2: 检查范围是否已完整选择（即 from 和 to 都有值）
    // 无论是选择了一个时间段，还是通过两次点击同一天选择单日，此条件都会满足
    if (range?.from && range.to) {
      // 步骤 3: 将最终确定的日期（已修正时区）传递给父组件
      setParentDate({ from: toUTCDate(range.from), to: toUTCDate(range.to) });
      // 步骤 4: 关闭弹窗，完成选择流程
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
    <div className={cn("w-full date-range-picker-container", className)}>
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
            {parentDate?.from && parentDate?.to ? (
              formatInUTC(parentDate.from) !== formatInUTC(parentDate.to) ? (
                <>
                  {formatInUTC(parentDate.from)} - {formatInUTC(parentDate.to)}
                </>
              ) : (
                formatInUTC(parentDate.from)
              )
            ) : parentDate?.from ? (
              formatInUTC(parentDate.from)
            ) : (
              <span>选择日期范围</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 flex date-range-picker-popover" 
          align="start" 
          side="bottom" 
          sideOffset={4}
          style={{ zIndex: 9999 }}
        >
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
            defaultMonth={localDate?.from || new Date()}
            selected={localDate}
            onSelect={handleDateSelect}
            numberOfMonths={1}
            locale={zhCN}
            // ★★★ 去掉"今天"的蓝点高亮 ★★★
            modifiers={{ today: [] }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
