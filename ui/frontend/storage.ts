import { DeepPartial } from 'ts-essentials';
import * as z from 'zod';

import { State } from './reducers';

type SimpleStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type PartialState = DeepPartial<State> | undefined;

type StorageFactory = () => SimpleStorage;

interface Config {
  storageFactory: StorageFactory;
  serialize: (state: State) => string;
  deserialize: (state: string) => PartialState;
}

interface InitializedStorage {
  initialState: PartialState;
  saveChanges: (state: State) => void;
  clear: () => void;
}

export function removeVersion<T extends { version?: unknown }>(data: T): Omit<T, 'version'> {
  const { version, ...rest } = data;
  return rest;
}

const File = z.object({ name: z.string(), content: z.string() });

export const Code = z.string().or(z.array(File));
export type Code = z.infer<typeof Code>;

type FileState = State['files'];
type ExpandedCode = { code?: string; files?: FileState };

export function expandCode<T extends { code?: Code }>(data: T): Omit<T, 'code'> & ExpandedCode {
  const { code, ...rest } = data;

  if (code === undefined) {
    return rest;
  }

  if (typeof code === 'string') {
    return { code, ...rest };
  } else {
    let fileId = 0;
    const files = code.map(({ name, content }) => ({
      id: fileId++,
      name,
      content,
    }));

    return { files: { fileId, files, active: 0 }, ...rest };
  }
}

export class InMemoryStorage {
  private data: { [s: string]: string } = {};

  public getItem(name: string): string {
    return this.data[name];
  }

  public setItem(name: string, value: string) {
    this.data[name] = value;
  }

  public removeItem(name: string) {
    delete this.data[name];
  }
}

const KEY = 'redux';

export function initializeStorage(config: Config) {
  return (): InitializedStorage => {
    const { storageFactory, serialize, deserialize } = config;

    const storage = validateStorage(storageFactory);
    const serializedState = storage.getItem(KEY);
    const initialState = serializedState ? deserialize(serializedState) : undefined;

    const saveChanges = (state: State) => {
      const serializedState = serialize(state);
      storage.setItem(KEY, serializedState);
    };

    const clear = () => storage.removeItem(KEY);

    return { initialState, saveChanges, clear };
  };
}

// Attempt to use the storage to see if security settings are
// preventing it. Falls back to dummy in-memory storage if needed.
function validateStorage(storageFactory: StorageFactory): SimpleStorage {
  try {
    const storage = storageFactory();
    const current = storage.getItem(KEY);
    storage.setItem(KEY, current || '');
    return storage;
  } catch (_e) {
    console.warn('Unable to store configuration, falling back to non-persistent in-memory storage');
    return new InMemoryStorage();
  }
}
