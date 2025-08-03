// 正确路径: src/components/ui/calendar.tsx

"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { DayPicker, CaptionProps } from "react-day-picker"
import { zhCN } from "date-fns/locale"
import { format, addYears, subYears } from "date-fns" // [核心修复] - 引入 format 函数

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { useNavigation } from "react-day-picker"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CalendarCaption,
      }}
      locale={zhCN}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

function CalendarCaption({ displayMonth }: CaptionProps) {
  const { goToMonth, nextMonth, previousMonth } = useNavigation();

  return (
    <div className="flex justify-center pt-1 relative items-center">
      <span className="text-sm font-medium">
        {format(displayMonth, "yyyy年 LLLL", { locale: zhCN })}
      </span>
      <div className="flex items-center gap-1 absolute right-1">
        <Button
          onClick={() => goToMonth(subYears(displayMonth, 1))}
          disabled={!previousMonth}
          variant="outline"
          size="icon"
          className="h-7 w-7"
        >
          <span className="sr-only">Go to previous year</span>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => previousMonth && goToMonth(previousMonth)}
          disabled={!previousMonth}
          variant="outline"
          size="icon"
          className="h-7 w-7"
        >
          <span className="sr-only">Go to previous month</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => nextMonth && goToMonth(nextMonth)}
          disabled={!nextMonth}
          variant="outline"
          size="icon"
          className="h-7 w-7"
        >
          <span className="sr-only">Go to next month</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => goToMonth(addYears(displayMonth, 1))}
          disabled={!nextMonth}
          variant="outline"
          size="icon"
          className="h-7 w-7"
        >
          <span className="sr-only">Go to next year</span>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export { Calendar }
