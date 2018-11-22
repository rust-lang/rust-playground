import { merge } from 'lodash';
import { StoreEnhancer, StoreEnhancerStoreCreator } from 'redux';

type SimpleStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface Config<S> {
  storage: SimpleStorage;
  serialize: (state: S) => string;
  deserialize: (state: string) => S;
}

const key = 'redux';

const storage = <St>(config: Config<St>): StoreEnhancer =>
  (createStore: StoreEnhancerStoreCreator<{}, St>) =>
    (reducer, preloadedState) => {
      const { storage, serialize, deserialize } = config;

      let serializedState;

      try {
        serializedState = storage.getItem(key);
      } catch (e) {
        console.warn(`Unable to load initial state from ${storage}: ${e}`); // tslint:disable-line:no-console
      }

      const persistedState = deserialize(serializedState);
      const mergedPreloadedState = merge(preloadedState, persistedState);
      const theStore = createStore(reducer, mergedPreloadedState);

      theStore.subscribe(() => {
        const state = theStore.getState();
        const serializedState = serialize(state);

        try {
          storage.setItem(key, serializedState);
        } catch (e) {
          console.warn(`Unable to save state to ${storage}: ${e}`); // tslint:disable-line:no-console
        }
      });

      return theStore;
    };

export default storage;
