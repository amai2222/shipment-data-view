// 正确路径: src/components/ui/date-range-picker.tsx
// 描述: [交互优化版] 实现了更直观的“两点式”日期范围选择

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

export function DateRangePicker({
  className,
  date,
  setDate,
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

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
    setDate({ from: fromDate, to: today });
    setOpen(false);
  };

  // ★★★ 核心修复逻辑 ★★★
  // 简化了日期选择处理函数，使其更符合直觉
  const handleDateSelect = (range: DateRange | undefined) => {
    // 1. 无论用户点击了什么，都立即更新父组件的状态
    //    这会让日历UI实时反映用户的第一次点击（选择了起始日期）
    setDate(range);

    // 2. 只有当用户完成了范围选择（即起始和结束日期都已确定）时，才关闭弹窗
    if (range?.from && range?.to) {
      // 如果用户两次点击的是同一个日期，`react-day-picker`会自动将 from 和 to 设为同一天
      // 这自然地实现了“选择单日”的功能
      setOpen(false);
    }
    // 如果只点击了起始日期 (range.to 未定义)，则什么都不做，保持弹窗打开，等待用户点击结束日期
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
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                // 使用 toDateString() 比较日期，避免时间部分的影响
                date.from.toDateString() === date.to.toDateString() ? (
                  format(date.from, "yyyy-MM-dd")
                ) : (
                  <>
                    {format(date.from, "yyyy-MM-dd")} -{" "}
                    {format(date.to, "yyyy-MM-dd")}
                  </>
                )
              ) : (
                format(date.from, "yyyy-MM-dd")
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
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            locale={zhCN}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
