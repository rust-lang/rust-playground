import 'core-js';
import 'regenerator-runtime/runtime';

import 'normalize.css/normalize.css';
import './index.module.css';

import { merge } from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, compose, createStore } from 'redux';
import thunk, { ThunkDispatch } from 'redux-thunk';
import * as url from 'url';

import {
  Action,
  editCode,
  enableFeatureGate,
  gotoPosition,
  selectText,
  addImport,
  performCratesLoad,
  performVersionsLoad,
  reExecuteWithBacktrace,
  browserWidthChanged,
} from './actions';
import { configureRustErrors } from './highlighting';
import localStorage from './local_storage';
import PageSwitcher from './PageSwitcher';
import playgroundApp from './reducers';
import { State } from './reducers';
import Router from './Router';
import sessionStorage from './session_storage';

const baseUrl = url.resolve(window.location.href, '/');

const initialGlobalState = {
  globalConfiguration: {
    baseUrl,
  },
};
const initialAppState = playgroundApp(undefined, { type: '@@APP_INIT' });
const initialState = merge(initialAppState, initialGlobalState);

const middlewares = applyMiddleware<ThunkDispatch<State, {}, Action>, {}>(thunk);
const composeEnhancers: typeof compose = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const enhancers = composeEnhancers(
  middlewares,
  localStorage,
  sessionStorage,
);
const store = createStore(playgroundApp, initialState, enhancers);

const z = (evt: MediaQueryList | MediaQueryListEvent) => { store.dispatch(browserWidthChanged(evt.matches)); };

const maxWidthMediaQuery = window.matchMedia('(max-width: 1600px)');
z(maxWidthMediaQuery);
maxWidthMediaQuery.addListener(z);

configureRustErrors({
  enableFeatureGate: featureGate => store.dispatch(enableFeatureGate(featureGate)),
  gotoPosition: (line, col) => store.dispatch(gotoPosition(line, col)),
  selectText: (start, end) => store.dispatch(selectText(start, end)),
  addImport: (code) => store.dispatch(addImport(code)),
  reExecuteWithBacktrace: () => store.dispatch(reExecuteWithBacktrace()),
  getChannel: () => store.getState().configuration.channel,
});

store.dispatch(performCratesLoad());
store.dispatch(performVersionsLoad());

window.rustPlayground = {
  setCode: code => {
    store.dispatch(editCode(code));
  },
};

ReactDOM.render(
  <Provider store={store}>
    <Router store={store} reducer={playgroundApp}>
      <PageSwitcher />
    </Router>
  </Provider>,
  document.getElementById('playground'),
);
