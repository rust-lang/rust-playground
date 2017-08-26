import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

// We are passed `dispatch` anyway, so we can make use of it
class Link extends React.Component<LinkProps> {
  render() {
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

  static contextTypes = {
    router: PropTypes.any,
  };
};

interface LinkProps extends React.HTMLAttributes<HTMLAnchorElement> {
  dispatch: (any) => any,
  action?: () => any,
  onClick?: () => any,
};

const LinkContainer = connect()(Link);

export default LinkContainer;
