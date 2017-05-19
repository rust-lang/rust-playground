import React from 'react';
import PropTypes from 'prop-types';

class Router extends React.Component {
  getChildContext() {
    return {
      router: this.props.router,
    };
  }

  render() {
    return this.props.children;
  }
}

Router.childContextTypes = {
  router: PropTypes.any,
};

Router.propTypes = {
  router: PropTypes.any.isRequired,
  children: PropTypes.node,
};

export default Router;
