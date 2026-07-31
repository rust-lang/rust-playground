import { UnknownAction, configureStore } from '@reduxjs/toolkit';

import { ThunkAction } from './actions';
import reducer from './reducers';

export type SimpleAction = ThunkAction | UnknownAction;
type State = ReturnType<typeof reducer>;

export const reduceAll = (actions: SimpleAction[]): State => {
  const store = configureStore({ reducer });
  for (const action of actions) {
    store.dispatch(action);
  }
  return store.getState();
};
