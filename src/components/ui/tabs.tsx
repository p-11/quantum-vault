import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Tabs = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) => (
  <TabsPrimitive.Root
    data-slot='tabs'
    className={cn('flex flex-col gap-2', className)}
    {...props}
  />
);

const TabsList = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List
    data-slot='tabs-list'
    className={cn(
      'text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg gap-4',
      className
    )}
    {...props}
  />
);

const TabsTrigger = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    data-slot='tabs-trigger'
    className={cn(
      "text-muted-foreground border-b-2 border-b-transparent data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-b-primary dark:data-[state=active]:text-foreground dark:data-[state=active]:border-b-success focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 px-2 py-1 text-sm whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  />
);

const TabsContent = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content
    data-slot='tabs-content'
    className={cn('flex-1 outline-none', className)}
    {...props}
  />
);

export { Tabs, TabsContent, TabsList, TabsTrigger };
