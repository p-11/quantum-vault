import { cn } from '@/lib/utils';

const Skeleton = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    data-slot='skeleton'
    className={cn('bg-skeleton animate-pulse rounded-md', className)}
    {...props}
  />
);

export { Skeleton };
