import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-accent-sage text-white shadow-[0_2px_12px_rgba(91,138,110,0.25)] hover:bg-[#5CA37F] hover:shadow-[0_4px_16px_rgba(91,138,110,0.35)] hover:-translate-y-[1px] focus-visible:ring-accent-sage',
        destructive:
          'bg-accent-terra text-white shadow-[0_2px_8px_rgba(196,113,74,0.2)] hover:bg-[#C47550] hover:-translate-y-[1px] focus-visible:ring-accent-terra',
        outline:
          'bg-transparent border-[1.5px] border-accent-sage text-accent-sage hover:bg-accent-sage-light focus-visible:ring-accent-sage',
        secondary:
          'bg-accent-sage-light border border-[#2C4A39] text-accent-sage hover:bg-[#15241C] focus-visible:ring-accent-sage',
        ghost:
          'bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary focus-visible:ring-accent-sage',
        link:
          'bg-transparent text-accent-sage underline-offset-4 hover:underline hover:text-[#5CA37F] focus-visible:ring-accent-sage p-0',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm:      'h-8 px-3 text-xs',
        lg:      'h-11 px-8',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size, asChild = false, ...props }, ref) => {
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
