// 正确路径: src/components/ui/date-range-picker.tsx

"use client"

import * as React from "react"
import { format, subDays, subMonths, subYears } from "date-fns"
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
                <>
                  {format(date.from, "yyyy-MM-dd")} -{" "}
                  {format(date.to, "yyyy-MM-dd")}
                </>
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
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
