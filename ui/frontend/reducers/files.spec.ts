import { SimpleAction, reduceAll as testReduceAll } from '../testReducer';
import * as files from './files';

const { default: _, ...actions } = files;

const reduceAll = (actions: SimpleAction[]) => testReduceAll(actions).files;

const expectFileOfName = (name: string) =>
  expect.arrayContaining([expect.objectContaining({ name })]);

describe('modifying the source code', () => {
  test('renaming a directory', () => {
    const state = reduceAll([
      actions.createFile('testing/test.rs'),
      actions.renameDirectory({ from: 'testing', to: 'testing/nested' }),
    ]);

    expect(state.files).not.toEqual(expectFileOfName('testing/test.rs'));
    expect(state.files).toEqual(expectFileOfName('testing/nested/test.rs'));
  });

  test('renaming a directory with a common prefix', () => {
    const state = reduceAll([
      actions.createFile('test/test.rs'),
      actions.createFile('test1/test.rs'),
      actions.renameDirectory({ from: 'test', to: 'test2' }),
    ]);

    expect(state.files).not.toEqual(expectFileOfName('test/test.rs'));
    expect(state.files).toEqual(expectFileOfName('test1/test.rs'));
    expect(state.files).toEqual(expectFileOfName('test2/test.rs'));
  });

  test('renaming a directory that would collide is a no-op', () => {
    const state = reduceAll([
      actions.createFile('a/main.rs'),
      actions.createFile('b/main.rs'),
      actions.renameDirectory({ from: 'a', to: 'b' }),
    ]);

    expect(state.files).toEqual(expectFileOfName('a/main.rs'));
    expect(state.files).toEqual(expectFileOfName('b/main.rs'));
  });

  test('deleting a directory removes all children', () => {
    const state = reduceAll([
      actions.createFile('a.rs'),
      actions.createFile('src/b.rs'),
      actions.createFile('src/c/d.rs'),
      actions.deleteDirectory('src'),
    ]);

    expect(state.files).toEqual(expectFileOfName('a.rs'));
    expect(state.files).not.toEqual(expectFileOfName('src/b.rs'));
    expect(state.files).not.toEqual(expectFileOfName('src/b/c.rs'));
  });
});
