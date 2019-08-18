import React from 'react';

import Link, { LinkProps } from './uss-router/Link';

export const SegmentedButtonSet: React.SFC = ({ children }) => (
  <div className="segmented-button">{children}</div>
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
      className={`segmented-button__button ${isBuild ? 'segmented-button__button--build' : ''}`}
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
      className={'segmented-button__button'}
    >
      {children}
    </Link>
  )
);
SegmentedLink.displayName = 'SegmentedLink';
