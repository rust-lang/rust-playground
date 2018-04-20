import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';

// We are passed `dispatch` anyway, so we can make use of it
class Link extends React.Component<LinkProps> {
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

type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;

export interface LinkProps extends Omit<React.HTMLProps<HTMLAnchorElement>, 'action'> {
  dispatch: (_: any) => any;
  action?: () => any;
  onClick?: () => any;
}

const LinkContainer = connect()(Link);

export default LinkContainer;
