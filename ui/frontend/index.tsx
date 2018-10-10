import 'babel-polyfill';

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, compose, createStore } from 'redux';
import persistState from 'redux-localstorage';
import thunk, { ThunkDispatch } from 'redux-thunk';
import * as url from 'url';

import {
  Action,
  enableFeatureGate,
  gotoPosition,
  performCratesLoad,
  performVersionsLoad,
  reExecuteWithBacktrace,
} from './actions';
import { configureRustErrors } from './highlighting';
import { deserialize, serialize } from './local_storage';
import PageSwitcher from './PageSwitcher';
import playgroundApp from './reducers';
import { State } from './reducers';
import Router from './Router';

const baseUrl = url.resolve(window.location.href, '/');

const initialState = {
  globalConfiguration: {
    baseUrl,
  },
};

const middlewares = applyMiddleware<ThunkDispatch<State, {}, Action>, {}>(thunk);
const composeEnhancers: typeof compose = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const enhancers = composeEnhancers(middlewares, persistState(undefined, { serialize, deserialize }));
const store = createStore(playgroundApp, initialState, enhancers);

configureRustErrors({
  enableFeatureGate: featureGate => store.dispatch(enableFeatureGate(featureGate)),
  gotoPosition: (line, col) => store.dispatch(gotoPosition(line, col)),
  reExecuteWithBacktrace: () => store.dispatch(reExecuteWithBacktrace()),
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
