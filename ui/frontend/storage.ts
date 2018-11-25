import { merge } from 'lodash';
import { StoreEnhancer, StoreEnhancerStoreCreator } from 'redux';

type SimpleStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface Config<S> {
  storageFactory: () => SimpleStorage;
  serialize: (state: S) => string;
  deserialize: (state: string) => S;
}

export class InMemoryStorage {
  private data = {};

  public getItem(name: string): string {
    return this.data[name];
  }

  public setItem(name: string, value: string) {
    this.data[name] = value;
  }
}

const key = 'redux';

const storage = <St>(config: Config<St>): StoreEnhancer =>
  (createStore: StoreEnhancerStoreCreator<{}, St>) =>
    (reducer, preloadedState) => {
      const { storageFactory, serialize, deserialize } = config;

      let storage: SimpleStorage;

      try {
        // Attempt to use the storage to see if security settings are preventing it.
        storage = storageFactory();
        const current = storage.getItem(key);
        storage.setItem(key, current);
      } catch (e) {
        // tslint:disable-next-line:no-console
        console.warn('Unable to store configuration, falling back to non-persistent in-memory storage');
        storage = new InMemoryStorage();
      }

      const serializedState = storage.getItem(key);
      const persistedState = deserialize(serializedState);
      const mergedPreloadedState = merge(preloadedState, persistedState);
      const theStore = createStore(reducer, mergedPreloadedState);

      theStore.subscribe(() => {
        const state = theStore.getState();
        const serializedState = serialize(state);
        storage.setItem(key, serializedState);
      });

      return theStore;
    };

export default storage;
