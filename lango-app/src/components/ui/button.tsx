import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs font-bold transition-all duration-200 ease-out active:scale-[0.97] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-[#2487B8] text-white hover:bg-[#1C6F99] shadow-2xs hover:shadow-md border border-transparent",
        primary: "bg-[#2487B8] text-white hover:bg-[#1C6F99] shadow-2xs hover:shadow-md border border-transparent",
        secondary: "bg-[#E4EDFD] text-[#2487B8] hover:bg-[#D4E4FD] border border-transparent shadow-2xs hover:shadow-xs",
        outline: "border border-slate-300 bg-white text-[#16212B] hover:bg-slate-50 hover:border-slate-400 shadow-2xs hover:shadow-xs",
        ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-[#16212B] border border-transparent",
        destructive: "bg-[#FCE4E2] text-[#E5544B] border border-[#F8C4C1] hover:bg-[#F9D4D1] shadow-2xs",
        danger: "bg-[#FCE4E2] text-[#E5544B] border border-[#F8C4C1] hover:bg-[#F9D4D1] shadow-2xs",
        link: "text-[#2487B8] underline-offset-4 hover:underline border border-transparent hover:translate-y-0",
      },
      size: {
        default: "min-h-[38px] px-4 py-2 text-xs gap-2",
        sm: "min-h-[34px] px-3.5 py-1.5 text-[11px] gap-1.5",
        md: "min-h-[38px] px-4 py-2 text-xs gap-2",
        lg: "min-h-[44px] px-5 py-2.5 text-sm gap-2.5",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
