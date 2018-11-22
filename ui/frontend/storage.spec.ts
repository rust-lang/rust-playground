import { createStore } from 'redux';

import storage from './storage';

class TestStorage {
  private data = {};

  public getItem(name: string): string {
    return this.data[name];
  }

  public setItem(name: string, value: string) {
    this.data[name] = value;
  }
}

const identityReducer = <S>() => (s: S, _a: any): S => s;
const serialize = JSON.stringify;
const deserialize = JSON.parse;

describe('restoring saved state', () => {
  test('partially serialized data is merged with initial state', () => {
    const testStorage = new TestStorage();
    testStorage.setItem('redux', serialize({ config: { alpha: true } }));

    const initialState = {
      config: { alpha: false, beta: 42 },
    };

    const enhancer = storage({ storage: testStorage, serialize, deserialize });
    const store = createStore(identityReducer<typeof initialState>(), initialState, enhancer);

    const state = store.getState();

    expect(state.config.alpha).toEqual(true);
    expect(state.config.beta).toEqual(42);
  });
});
