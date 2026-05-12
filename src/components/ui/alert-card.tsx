import type { ReactNode } from 'react';

type AlertCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

export const AlertCard = ({ icon, title, description }: AlertCardProps) => {
  return (
    <div className='flex items-start gap-4 rounded-md border border-border bg-background p-4'>
      <div className='flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground [&_svg]:size-6'>
        {icon}
      </div>
      <div className='flex flex-col gap-1.5'>
        <p className='text-base font-medium leading-normal text-foreground'>
          {title}
        </p>
        <p className='text-sm leading-snug text-muted-foreground'>
          {description}
        </p>
      </div>
    </div>
  );
};
