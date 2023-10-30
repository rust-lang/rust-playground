import React from 'react';

import Link, { LinkProps } from './uss-router/Link';

import styles from './ButtonSet.module.css';

interface ButtonSetProps {
  children: React.ReactNode;
}

export const ButtonSet: React.FC<ButtonSetProps> = ({ children }) => (
  <div className={styles.set}>{children}</div>
);

type HTMLButton = JSX.IntrinsicElements['button'];

interface ButtonProps extends HTMLButton {
  isPrimary?: boolean;
  iconLeft?: React.FC;
  iconRight?: React.FC;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ isPrimary = false, iconLeft: IconLeft, iconRight: IconRight, children, ...props }, ref) => {
    const iconLeft = IconLeft && (
      <span className={styles.iconLeft}>
        <IconLeft />
      </span>
    );
    const iconRight = IconRight && (
      <span className={styles.iconRight}>
        <IconRight />
      </span>
    );
    const ordinalStyle = isPrimary ? styles.primary : styles.secondary;

    return (
      <button ref={ref} className={ordinalStyle} {...props}>
        {iconLeft}
        {children}
        {iconRight}
      </button>
    );
  },
);
Button.displayName = 'Button';

export const Rule: React.FC = () => <span className={styles.rule} />;

export const IconButton = React.forwardRef<HTMLButtonElement, HTMLButton>(
  ({ children, ...props }, ref) => (
    <button ref={ref} className={styles.icon} {...props}>
      {children}
    </button>
  ),
);
IconButton.displayName = 'IconButton';

export const IconLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ children, ...props }, ref) => (
    <Link ref={ref} className={styles.icon} {...props}>
      {children}
    </Link>
  ),
);
IconLink.displayName = 'IconLink';
