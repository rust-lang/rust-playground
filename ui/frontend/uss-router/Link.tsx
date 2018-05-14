import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';

type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

interface LinkInnerProps extends LinkProps {
  dispatch: (_: any) => any;
}

// We are passed `dispatch` anyway, so we can make use of it
class LinkInner extends React.Component<LinkInnerProps> {
  public render() {
    const { dispatch, action, onClick, children, ...rest } = this.props;
    const { router } = this.context;

    const location = router.provisionalLocation(action);
    const href = location.pathname;

    const realOnClick = e => {
      if (onClick) {
        onClick();
      } else {
        dispatch(action());
      }
      e.preventDefault();
    };

    return (
      <a {...rest} href={href} onClick={realOnClick}>
        {children}
      </a>
    );
  }

  public static contextTypes = {
    router: PropTypes.any,
  };
}

export interface LinkProps extends Omit<React.HTMLProps<HTMLAnchorElement>, 'action' | 'onClick'> {
  action?: () => any;
  onClick?: () => any;
}

const LinkContainer = connect()(LinkInner);

export default LinkContainer;
