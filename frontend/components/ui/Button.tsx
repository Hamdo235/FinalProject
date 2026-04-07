import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default:     'text-white focus-visible:ring-cyan-400',
        destructive: 'focus-visible:ring-red-500',
        outline:     'focus-visible:ring-cyan-400',
        secondary:   'focus-visible:ring-cyan-400',
        ghost:       'focus-visible:ring-cyan-400',
        link:        'underline-offset-4 hover:underline focus-visible:ring-cyan-400',
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

const variantStyles: Record<string, React.CSSProperties> = {
  default: {
    background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
    boxShadow: '0 0 18px rgba(34,211,238,0.3)',
    color: '#fff',
  },
  destructive: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#ef4444',
  },
  outline: {
    background: 'transparent',
    border: '1px solid rgba(34,211,238,0.25)',
    color: '#67e8f9',
  },
  secondary: {
    background: 'rgba(34,211,238,0.08)',
    border: '1px solid rgba(34,211,238,0.15)',
    color: '#22d3ee',
  },
  ghost: {
    background: 'transparent',
    color: '#67e8f9',
  },
  link: {
    background: 'transparent',
    color: '#22d3ee',
    padding: 0,
  },
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const vs = variantStyles[variant ?? 'default'] ?? {};
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        style={{ ...vs, ...style }}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
