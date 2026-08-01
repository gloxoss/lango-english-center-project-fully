import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
    icon?: React.ReactNode;
  }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative w-full flex items-center">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center justify-center">
            {icon}
          </div>
          <input
            type={type}
            className={cn(
              "flex h-9 w-full rounded-lg border border-slate-200 bg-[#EDF3F8]/40 pl-9 pr-3.5 py-2 text-xs font-medium text-[#16212B] placeholder:text-slate-400 focus:bg-white focus:border-[#2487B8] focus:ring-2 focus:ring-[#2487B8]/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-150 shadow-2xs",
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-slate-200 bg-[#EDF3F8]/40 px-3.5 py-2 text-xs font-medium text-[#16212B] placeholder:text-slate-400 focus:bg-white focus:border-[#2487B8] focus:ring-2 focus:ring-[#2487B8]/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-150 shadow-2xs",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
