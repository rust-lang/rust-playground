import React from 'react';

import Link, { LinkProps } from './uss-router/Link';

export const SegmentedButtonSet: React.SFC<{}> = ({ children }) => (
  <div className="segmented-button">{children}</div>
);

interface SegmentedButtonInnerProps extends SegmentedButtonProps {
  innerRef: React.Ref<HTMLButtonElement>;
}

const SegmentedButtonInner: React.SFC<SegmentedButtonInnerProps> = ({ innerRef, isBuild, children, ...props }) => (
  <button
    ref={innerRef}
    {...props}
    className={`segmented-button__button ${isBuild ? 'segmented-button__button--build' : ''}`}>
    {children}
  </button>
);

interface SegmentedButtonProps extends React.HTMLProps<HTMLButtonElement> {
  isBuild?: boolean;
}

export const SegmentedButton = React.forwardRef<HTMLButtonElement, SegmentedButtonProps>((props, ref) => (
  <SegmentedButtonInner innerRef={ref} {...props} />
));

interface SegmentedLinkInnerProps extends LinkProps {
  // I can't figure out how to make these types line up
  innerRef: any;
}

const SegmentedLinkInner: React.SFC<SegmentedLinkInnerProps> = ({ innerRef, children, ...props }) => (
  <Link
    ref={innerRef}
    {...props}
    className={'segmented-button__button'}>
    {children}
  </Link>
);

export const SegmentedLink = React.forwardRef<typeof Link, LinkProps>((props, ref) => (
  <SegmentedLinkInner innerRef={ref} {...props} />
));
