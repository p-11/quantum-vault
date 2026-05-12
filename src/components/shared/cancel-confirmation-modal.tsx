import { useRef } from 'react';

import { Modal } from '@/components/modal';
import { Button } from '@/components/ui/button';
import { useKeyDown } from '@/hooks/use-key-down';
import { useOnClickOutside } from '@/hooks/use-on-click-outside';

type CancelConfirmationModalProps = {
  open: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  isConfirmDisabled?: boolean;
  title?: string;
  description?: string;
};

const defaultTitle = 'Are you sure?';
const defaultDescription =
  "Your wallet hasn't been created yet. Once cancelled, you'll need to restart the process to create a wallet.";

export const CancelConfirmationModal = ({
  open,
  onConfirm,
  onDismiss,
  isConfirmDisabled = false,
  title = defaultTitle,
  description = defaultDescription
}: CancelConfirmationModalProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useKeyDown({
    keys: ['Escape'],
    handler: () => {
      if (open) {
        onDismiss();
      }
    }
  });

  useOnClickOutside({
    ref: panelRef,
    onClickOutside: () => {
      if (open) {
        onDismiss();
      }
    }
  });

  return (
    <Modal show={open} onDismiss={onDismiss}>
      <div ref={panelRef} className='flex flex-col gap-6 p-6'>
        <div className='flex flex-col gap-3'>
          <h2 className='type-heading-lg text-foreground'>{title}</h2>
          <p className='text-muted-foreground text-base leading-normal'>
            {description}
          </p>
        </div>

        <div className='flex flex-col gap-4'>
          <Button
            size='flow'
            variant='destructive'
            onClick={onConfirm}
            disabled={isConfirmDisabled}
          >
            Yes
          </Button>
          <Button size='flow' variant='secondary' onClick={onDismiss}>
            No
          </Button>
        </div>
      </div>
    </Modal>
  );
};
