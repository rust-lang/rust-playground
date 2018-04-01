import React from 'react';

import Link, { LinkProps } from './uss-router/Link';

export const SegmentedButtonSet: React.SFC<{}> = ({ children }) => (
  <div className="segmented-button">{children}</div>
);

interface SegmentedButtonProps extends React.HTMLProps<HTMLButtonElement> {
  isBuild?: boolean;
  innerRef: React.Ref<HTMLElement>;
}

const SegmentedButtonInner: React.SFC<SegmentedButtonProps> = ({ innerRef, isBuild, children, ...props }) => (
  <button
    ref={innerRef}
    {...props}
    className={`segmented-button__button ${isBuild ? 'segmented-button__button--build' : ''}`}>
    {children}
  </button>
);

export const SegmentedButton = React.forwardRef((props, ref) => (
  <SegmentedButtonInner innerRef={ref} {...props} />
));

interface SegmentedLinkProps {
  title?: string;
  innerRef: React.Ref<any>;
}

const SegmentedLinkInner: React.SFC<SegmentedLinkProps> = ({ innerRef, children, ...props }) => (
  <Link
    ref={innerRef}
    {...props}
    className={'segmented-button__button'}>
    {children}
  </Link>
);

export const SegmentedLink = React.forwardRef((props, ref) => (
  <SegmentedLinkInner innerRef={ref} {...props} />
));
