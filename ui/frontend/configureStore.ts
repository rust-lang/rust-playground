import { merge } from 'lodash-es';
import { useDispatch } from 'react-redux';
import { configureStore as reduxConfigureStore } from '@reduxjs/toolkit';
import { produce } from 'immer';
import type {} from 'redux-thunk/extend-redux';

import { initializeApplication } from './actions';
import initializeLocalStorage from './local_storage';
import initializeSessionStorage from './session_storage';
import { websocketMiddleware } from './websocketMiddleware';
import reducer from './reducers';

export default function configureStore(window: Window) {
  const baseUrl = new URL('/', window.location.href).href;
  const websocket = websocketMiddleware(window);

  const initialGlobalState = {
    globalConfiguration: {
      baseUrl,
    },
  };
  const initialAppState = reducer(undefined, initializeApplication());

  const localStorage = initializeLocalStorage();
  const sessionStorage = initializeSessionStorage();

  const preloadedState = produce(initialAppState, (initialAppState) => merge(
    initialAppState,
    initialGlobalState,
    localStorage.initialState,
    sessionStorage.initialState,
  ));

  const store = reduxConfigureStore({
    reducer,
    preloadedState,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(websocket),
  })

  store.subscribe(() => {
    const state = store.getState();

    // Some automated tests run fast enough that the following interleaving is possible:
    //
    // 1. RSpec test finishes, local/session storage cleared
    // 2. WebSocket connects, the state updates, and the local/session storage is saved
    // 3. Subsequent RSpec test starts and local/session storage has been preserved
    //
    // We allow the tests to stop saving to sidestep that.
    if (state.globalConfiguration.syncChangesToStorage) {
      localStorage.saveChanges(state);
      sessionStorage.saveChanges(state);
    }
  })

  return store;
}

export type AppDispatch = ReturnType<typeof configureStore>['dispatch'];
export const useAppDispatch = () => useDispatch<AppDispatch>()
