import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

// We are passed `dispatch` anyway, so we can make use of it
const Link = ({ dispatch, action, onClick, children, ...rest }, { router }) => {
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
};

Link.contextTypes = {
  router: PropTypes.any,
};

Link.propTypes = {
  dispatch: PropTypes.func.isRequired,
  action: PropTypes.func,
  onClick: PropTypes.func,
  children: PropTypes.node,
};

const LinkContainer = connect()(Link);

export default LinkContainer;
