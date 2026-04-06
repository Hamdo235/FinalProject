import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default:
          'bg-cyan-500 text-black font-semibold hover:bg-cyan-400 hover:shadow-[0_0_16px_rgba(0,212,255,0.5)] focus-visible:ring-cyan-500',
        destructive:
          'bg-[#ff4757]/20 text-[#ff4757] border border-[#ff4757]/40 hover:bg-[#ff4757]/30 focus-visible:ring-[#ff4757]',
        outline:
          'border border-[rgba(0,212,255,0.25)] bg-transparent text-[#e2e8f0] hover:bg-[rgba(0,212,255,0.08)] hover:border-[rgba(0,212,255,0.5)] focus-visible:ring-cyan-500',
        secondary:
          'bg-[#0f1629] text-[#e2e8f0] border border-[rgba(0,212,255,0.15)] hover:bg-[rgba(0,212,255,0.06)] focus-visible:ring-cyan-500',
        ghost:
          'text-[#e2e8f0] hover:bg-[rgba(0,212,255,0.08)] hover:text-[#00d4ff] focus-visible:ring-cyan-500',
        link:
          'text-[#00d4ff] underline-offset-4 hover:underline focus-visible:ring-cyan-500',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm:      'h-8 rounded-md px-3 text-xs',
        lg:      'h-11 rounded-md px-8',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
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
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
