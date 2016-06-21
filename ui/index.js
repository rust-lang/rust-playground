import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { applyMiddleware, createStore } from 'redux';
import createLogger from 'redux-logger';
import thunk from 'redux-thunk';

import playgroundApp from './reducers';
import Header from './Header.jsx';

const logger = createLogger(); // TODO: Development only
const store = createStore(
  playgroundApp,
  applyMiddleware(thunk, logger)
);

ReactDOM.render(
  <Provider store={store}>
    <Header />
  </Provider>,
  document.getElementById('playground')
);
