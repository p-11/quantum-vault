import { useState, type ReactNode } from 'react';

type OpenerProps = {
  renderTrigger: (props: { onClick: () => void }) => ReactNode;
  renderContent: (props: { onClose: () => void }) => ReactNode;
};

export const Opener = ({ renderTrigger, renderContent }: OpenerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {renderTrigger({ onClick: () => setIsOpen(true) })}
      {isOpen && renderContent({ onClose: () => setIsOpen(false) })}
    </>
  );
};
