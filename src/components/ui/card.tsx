import * as React from 'react';

import { cn } from '@/lib/utils';

const Card = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot='card'
    className={cn(
      'bg-card text-card-foreground flex flex-col gap-4 rounded-xl border py-4 my-4',
      className
    )}
    {...props}
  />
);

const CardHeader = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot='card-header'
    className={cn(
      '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6',
      className
    )}
    {...props}
  />
);

const CardTitle = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot='card-title'
    className={cn('leading-none font-medium', className)}
    {...props}
  />
);

const CardDescription = ({
  className,
  ...props
}: React.ComponentProps<'div'>) => (
  <div
    data-slot='card-description'
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
);

const CardAction = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot='card-action'
    className={cn(
      'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
      className
    )}
    {...props}
  />
);

const CardContent = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-slot='card-content' className={cn('px-5', className)} {...props} />
);

const CardFooter = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot='card-footer'
    className={cn('flex items-center px-5 [.border-t]:pt-6', className)}
    {...props}
  />
);

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
};
