import React from 'react';
import PropTypes from 'prop-types';

class Router extends React.Component<RouterProps> {
  getChildContext() {
    return {
      router: this.props.router,
    };
  }

  render() {
    return React.Children.only(this.props.children);
  }

  static childContextTypes = {
    router: PropTypes.any,
  };
}

interface RouterProps {
  router: any,
};

export default Router;
