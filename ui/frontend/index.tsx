import 'babel-polyfill';

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, compose, createStore } from 'redux';
import persistState from 'redux-localstorage';
import thunk from 'redux-thunk';
import * as url from 'url';

import { gotoPosition, performCratesLoad, performVersionsLoad } from './actions';
import { configureRustErrors } from './highlighting';
import { deserialize, serialize } from './local_storage';
import PageSwitcher from './PageSwitcher';
import playgroundApp from './reducers';
import Router from './Router';

const baseUrl = url.resolve(window.location.href, '/');

const initialState = {
  globalConfiguration: {
    baseUrl,
  },
};

const mw = [thunk];
const middlewares = applyMiddleware(...mw);
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const enhancers = composeEnhancers(middlewares, persistState(undefined, { serialize, deserialize }));
const store = createStore(playgroundApp, initialState, enhancers);

configureRustErrors({
  gotoPosition: (line, col) => store.dispatch(gotoPosition(line, col)),
  getChannel: () => store.getState().configuration.channel,
});

store.dispatch(performCratesLoad());
store.dispatch(performVersionsLoad());

ReactDOM.render(
  <Provider store={store}>
    <Router store={store} reducer={playgroundApp}>
      <PageSwitcher />
    </Router>
  </Provider>,
  document.getElementById('playground'),
);
