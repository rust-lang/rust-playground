import PropTypes from 'prop-types';
import React from 'react';

class Router extends React.Component<RouterProps> {
  public getChildContext() {
    return {
      router: this.props.router,
    };
  }

  public render() {
    return React.Children.only(this.props.children);
  }

  public static childContextTypes = {
    router: PropTypes.any,
  };
}

interface RouterProps {
  router: any;
}

export default Router;
