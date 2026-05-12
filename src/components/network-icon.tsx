export const NetworkIcon = ({ iconUrl }: { iconUrl: string }) => (
  <div className='size-6 border flex items-center justify-center bg-background'>
    <img src={iconUrl} className='size-4 rounded-full' alt='Network icon' />
  </div>
);
