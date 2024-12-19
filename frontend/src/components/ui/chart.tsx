import * as React from "react";

import { cn } from "@/lib/utils";

const Chart = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("", className)} {...props} />
));
Chart.displayName = "Chart";

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative h-full w-full", className)}
    {...props}
  />
));
ChartContainer.displayName = "ChartContainer";

export { Chart, ChartContainer };