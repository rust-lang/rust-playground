import React from 'react';

import Link, { LinkProps } from './uss-router/Link';

import styles from './SegmentedButton.module.css';

export const SegmentedButtonSet: React.FC = ({ children }) => (
  <div className={styles.container}>{children}</div>
);

type Button = JSX.IntrinsicElements['button'];

interface SegmentedButtonProps extends Button {
  isBuild?: boolean;
}

export const SegmentedButton = React.forwardRef<HTMLButtonElement, SegmentedButtonProps>(
  ({ isBuild, children, ...props }, ref) => (
    <button
      ref={ref}
      {...props}
      className={isBuild ? styles.buttonBuild : styles.button}
    >
      {children}
    </button>
  )
);
SegmentedButton.displayName = 'SegmentedButton';

export const SegmentedLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ children, ...props }, ref) => (
    <Link
      ref={ref}
      {...props}
      className={styles.button}
    >
      {children}
    </Link>
  )
);
SegmentedLink.displayName = 'SegmentedLink';
