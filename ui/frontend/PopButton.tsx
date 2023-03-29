import {
  FloatingArrow,
  FloatingFocusManager,
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import React, { useCallback, useRef, useState } from 'react';

import styles from './PopButton.module.css';

interface NewPopProps {
  Button: React.ComponentType<
    {
      toggle: () => void;
    } & React.RefAttributes<HTMLButtonElement>
  >;
  Menu: React.ComponentType<{ close: () => void }>;
}

const PopButton: React.FC<NewPopProps> = ({ Button, Menu }) => {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const close = useCallback(() => setIsOpen(false), []);

  const arrowRef = useRef(null);

  const { x, y, refs, strategy, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(10), flip(), shift(), arrow({ element: arrowRef })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  return (
    <>
      <Button toggle={toggle} ref={refs.setReference} {...getReferenceProps()} />

      {isOpen && (
        <FloatingFocusManager context={context}>
          <div
            ref={refs.setFloating}
            className={styles.container}
            style={{
              position: strategy,
              top: y ?? 0,
              left: x ?? 0,
              width: 'max-content',
            }}
            {...getFloatingProps()}
          >
            <FloatingArrow ref={arrowRef} context={context} height={10} width={20} fill="white" />
            <div className={styles.content}>
              <Menu close={close} />
            </div>
          </div>
        </FloatingFocusManager>
      )}
    </>
  );
};

export default PopButton;
