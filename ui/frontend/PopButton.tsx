import React, { useCallback, useState, useEffect } from 'react';
import { usePopper } from 'react-popper';
import { Portal } from 'react-portal';

import styles from './PopButton.module.css';

interface NewPopProps {
  Button: React.ComponentType<{
    toggle: () => void;
  } & React.RefAttributes<HTMLButtonElement>>;
  Menu: React.ComponentType<{ close: () => void }>;
}

const PopButton: React.FC<NewPopProps> = ({ Button, Menu }) => {
  const [isOpen, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen(v => !v), []);
  const close = useCallback(() => setOpen(false), []);

  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLElement | null>(null);
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null);

  const { styles: popperStyles, attributes: popperAttributes } = usePopper(referenceElement, popperElement, {
    modifiers: [
      { name: 'arrow', options: { element: arrowElement } },
      // Issue #303
      { name: 'computeStyles', options: { gpuAcceleration: false } },
    ],
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) { return; }

      if (referenceElement && referenceElement.contains(event.target)) {
        // They are clicking on the button, so let that go ahead and close us.
        return;
      }

      if (popperElement && !popperElement.contains(event.target)) {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, referenceElement, popperElement, close]);

  return (
    <>
      <Button ref={setReferenceElement} toggle={toggle} />

      {isOpen && <Portal>
        <div
          ref={setPopperElement}
          className={styles.container}
          style={popperStyles.popper}
          {...popperAttributes.popper}>
          <div
            ref={setArrowElement}
            className={styles.arrow}
            style={popperStyles.arrow}
            {...popperAttributes.arrow} />
          <div className={styles.content}>
            <Menu close={close} />
          </div>
        </div>
      </Portal>}
    </>
  );
};

export default PopButton;
