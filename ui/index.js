import "babel-polyfill";

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore, compose } from 'redux';
import createLogger from 'redux-logger';
import thunk from 'redux-thunk';
import persistState from 'redux-localstorage';

import playgroundApp from './reducers';
import Playground from './Playground.jsx';

const CURRENT_VERSION = 1;

function serialize(state) {
  return JSON.stringify({
    version: CURRENT_VERSION,
    code: state.code
  });
}

function deserialize(savedState) {
  if (!savedState) { return undefined; }
  const parsedState = JSON.parse(savedState);
  if (parsedState.version != CURRENT_VERSION) { return undefined; }

  return {
    code: parsedState.code
  };
}

const logger = createLogger(); // TODO: Development only
const middlewares = applyMiddleware(thunk, logger);
const enhancers = compose(middlewares,  persistState(undefined, { serialize, deserialize}));
const store = createStore(playgroundApp, enhancers);

ReactDOM.render(
  <Provider store={store}>
    <Playground />
  </Provider>,
  document.getElementById('playground')
);
