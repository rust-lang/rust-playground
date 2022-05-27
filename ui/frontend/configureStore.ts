import { merge } from 'lodash';
import { applyMiddleware, compose, createStore } from 'redux';
import { useDispatch } from 'react-redux';
import thunk, { ThunkDispatch } from 'redux-thunk';
import * as url from 'url';

import { Action } from './actions';
import localStorage from './local_storage';
import sessionStorage from './session_storage';
import playgroundApp, { State } from './reducers';

export default function configureStore(window: Window) {
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
  return createStore(playgroundApp, initialState, enhancers);
}
