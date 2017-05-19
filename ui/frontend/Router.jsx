import React from 'react';
import PropTypes from 'prop-types';

import createHistory from 'history/createBrowserHistory';
import UssRouter from './uss-router/Router.jsx';
import { createRouter } from './uss-router';

import Route from 'route-parser';
import qs from 'qs';

import { helpPageLoad, indexPageLoad } from './actions';

const homeRoute = new Route('/');
const helpRoute = new Route('/help');

const stateSelector = ({ page, configuration: { channel, mode } }) => ({
  page,
  configuration: {
    channel,
    mode,
  }
});

const stateToLocation = ({ page, configuration }) => {
  switch (page) {
  case 'help': {
    return {
      pathname: `/help`,
    };
  }

  default: {
    const query = {
      version: configuration.channel,
      mode: configuration.mode,
    };
    return {
      pathname: `/?${qs.stringify(query)}`,
    };
  }
  }
};

const locationToAction = location => {
  const matchedHelp = helpRoute.match(location.pathname);

  if (matchedHelp) {
    return helpPageLoad();
  }

  const matched = homeRoute.match(location.pathname);

  if (matched) {
    return indexPageLoad(qs.parse(location.search.slice(1)));
  }

  return null;
};

export default class Router extends React.Component {
  constructor(props) {
    super();

    const history = createHistory();

    const { store, reducer } = props;

    this.router = createRouter({
      store, reducer,
      history, stateSelector, locationToAction, stateToLocation,
    });
  }

  render() {
    return <UssRouter router={this.router}>{this.props.children}</UssRouter>;
  }
}

Router.propTypes = {
  store: PropTypes.any.isRequired,
  reducer: PropTypes.any.isRequired,
  children: PropTypes.node,
};
