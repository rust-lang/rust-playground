import "babel-polyfill";

import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore, compose } from 'redux';
import thunk from 'redux-thunk';
import persistState from 'redux-localstorage';

import { configureRustErrors } from './highlighting';
import { serialize, deserialize } from './local_storage';
import playgroundApp from './reducers';
import { gotoPosition } from './actions';
import Router from './Router';
import PageSwitcher from './PageSwitcher';

const mw = [thunk];
const middlewares = applyMiddleware(...mw);
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const enhancers = composeEnhancers(middlewares, persistState(undefined, { serialize, deserialize }));
const store = createStore(playgroundApp, enhancers);

const tick = () => store.dispatch({ type: 'TICK', date: new Date() });
tick();
window.setInterval(tick, 30 * 1000);

configureRustErrors((line, col) => store.dispatch(gotoPosition(line, col)));

ReactDOM.render(
  <Provider store={store}>
    <Router store={store} reducer={playgroundApp}>
      <PageSwitcher />
    </Router>
  </Provider>,
  document.getElementById('playground')
);
