import React, { useContext, useCallback, MouseEventHandler } from 'react';

import { Context } from './Router';
import { useAppDispatch } from '../hooks';

type Anchor = JSX.IntrinsicElements['a'];
type SlimAnchor = Omit<Anchor, 'action' | 'onClick'>;

export interface LinkProps extends SlimAnchor {
  action?: () => any;
  onClick?: () => void;
}

const Link: React.FC<LinkProps> = (props) => {
  const dispatch = useAppDispatch();
  const router = useContext(Context);
  const { action, onClick, children, ...anchorProps } = props;

  const realOnClick: MouseEventHandler<HTMLAnchorElement> = useCallback((e) => {
    if (onClick) {
      onClick();
    } else if (action) {
      dispatch(action());
    }
    e.preventDefault();
  }, [action, dispatch, onClick]);

  if (!router) { return null; }

  const location = router.provisionalLocation(action);
  const href = location.pathname;

  return (
    <a {...anchorProps} href={href} onClick={realOnClick}>
      {children}
    </a>
  );
};

export default Link;
