/* global process:false */

import "babel-polyfill";

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore, compose } from 'redux';
import createLogger from 'redux-logger';
import thunk from 'redux-thunk';
import persistState from 'redux-localstorage';
import url from 'url';

import { configureRustErrors } from './highlighting';
import { serialize, deserialize } from './local_storage';
import playgroundApp from './reducers';
import { gotoPosition, editCode, performGistLoad } from './actions';
import Playground from './Playground';

const mw = [thunk];
if (process.env.NODE_ENV !== 'production') {
  mw.push(createLogger());
}
const middlewares = applyMiddleware(...mw);
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const enhancers = composeEnhancers(middlewares, persistState(undefined, { serialize, deserialize }));
const store = createStore(playgroundApp, enhancers);

configureRustErrors((line, col) => store.dispatch(gotoPosition(line, col)));

// Process query parameters
const urlObj = url.parse(window.location.href, true);
const query = urlObj.query;

if (query.code) {
  store.dispatch(editCode(query.code));
} else if (query.gist) {
  store.dispatch(performGistLoad(query.gist));
}

ReactDOM.render(
  <Provider store={store}>
    <Playground />
  </Provider>,
  document.getElementById('playground')
);
