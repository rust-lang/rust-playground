import { merge } from 'lodash';
import { applyMiddleware, compose, createStore } from 'redux';
import { useDispatch } from 'react-redux';
import thunk, { ThunkDispatch } from 'redux-thunk';
import * as url from 'url';

import { Action, initializeApplication } from './actions';
import initializeLocalStorage from './local_storage';
import initializeSessionStorage from './session_storage';
import playgroundApp, { State } from './reducers';

export default function configureStore(window: Window) {
  const baseUrl = url.resolve(window.location.href, '/');

  const initialGlobalState = {
    globalConfiguration: {
      baseUrl,
    },
  };
  const initialAppState = playgroundApp(undefined, initializeApplication());

  const localStorage = initializeLocalStorage();
  const sessionStorage = initializeSessionStorage();

  const initialState = merge(
    initialAppState,
    initialGlobalState,
    localStorage.initialState,
    sessionStorage.initialState,
  );

  const middlewares = applyMiddleware<ThunkDispatch<State, {}, Action>, {}>(thunk);
  const composeEnhancers: typeof compose = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
  const enhancers = composeEnhancers(middlewares);
  const store = createStore(playgroundApp, initialState, enhancers);

  store.subscribe(() => {
    const state = store.getState();
    localStorage.saveChanges(state);
    sessionStorage.saveChanges(state);
  })

  return store;
}

export type AppDispatch = ReturnType<typeof configureStore>['dispatch'];
export const useAppDispatch = () => useDispatch<AppDispatch>()
