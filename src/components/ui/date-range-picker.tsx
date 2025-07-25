// 文件路径: src/components/ui/date-range-picker.tsx
"use client"

import * as React from "react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale" // 引入中文语言包
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
  onDateChange: (date: DateRange | undefined) => void;
}

export function DateRangePicker({ className, date, onDateChange }: DateRangePickerProps) {
  
  // 【核心修正】处理单日选择的逻辑
  const handleSelect = (selectedRange: DateRange | undefined) => {
    if (selectedRange?.from && !selectedRange.to) {
      // 如果用户只选了一个开始日期，我们创建一个新的范围对象
      // 这样即使用户再次点击同一个日期，它也会被正确地设置为结束日期
      const newRange = { from: selectedRange.from, to: selectedRange.from };
      onDateChange(newRange);
    } else {
      // 否则，正常更新范围
      onDateChange(selectedRange);
    }
  };

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-[260px] justify-start text-left font-normal h-8",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                // 如果开始和结束日期是同一天，只显示一个日期
                format(date.from, 'PPP', { locale: zhCN }) === format(date.to, 'PPP', { locale: zhCN }) ? (
                  format(date.from, "y年 LLL do", { locale: zhCN })
                ) : (
                  <>
                    {format(date.from, "y年 LLL do", { locale: zhCN })} -{" "}
                    {format(date.to, "y年 LLL do", { locale: zhCN })}
                  </>
                )
              ) : (
                format(date.from, "y年 LLL do", { locale: zhCN })
              )
            ) : (
              <span>选择日期范围</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onDateChange} // 直接使用 onDateChange，day-picker 库已内置单日选择逻辑
            numberOfMonths={2}
            locale={zhCN}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
