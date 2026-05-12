import { Toaster } from './components/ui/sonner';
import { ScreenProvider } from './providers/screen-provider';

const App = () => {
  return (
    <>
      <Toaster position='top-left' duration={3000} />

      <div className='relative h-(--popup-height) w-(--popup-width) overflow-x-hidden overflow-y-auto bg-background'>
        <ScreenProvider />
      </div>
    </>
  );
};

export default App;
