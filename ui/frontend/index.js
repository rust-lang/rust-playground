import "babel-polyfill";

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore, compose } from 'redux';
import createLogger from 'redux-logger';
import thunk from 'redux-thunk';
import persistState from 'redux-localstorage';
import url from 'url';

import { serialize, deserialize } from './local_storage';
import playgroundApp from './reducers';
import { performGistLoad } from './actions';
import Playground from './Playground.jsx';

var mw = [thunk];
if (process.env.NODE_ENV !== 'production') {
  mw.push(createLogger());
}
const middlewares = applyMiddleware(...mw);
const enhancers = compose(middlewares, persistState(undefined, { serialize, deserialize }));
const store = createStore(playgroundApp, enhancers);

// Process query parameters
const urlObj = url.parse(window.location.href, true);
const query = urlObj.query;

if (query.gist) {
  store.dispatch(performGistLoad(query.gist));
}

ReactDOM.render(
  <Provider store={store}>
    <Playground />
  </Provider>,
  document.getElementById('playground')
);
