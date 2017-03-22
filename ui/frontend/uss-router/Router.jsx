import React, { PropTypes } from 'react';

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
  router: React.PropTypes.any,
};

Router.propTypes = {
  router: PropTypes.any.isRequired,
  children: PropTypes.node,
};

export default Router;
