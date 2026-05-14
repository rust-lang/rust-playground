import { UnknownAction } from '@reduxjs/toolkit';

import reducer from '../reducers';
import { editCode } from '../reducers/code';
import { changeFileView } from '../reducers/configuration';
import { featureFlagsForceEnableAll } from '../reducers/featureFlags';
import { activateFile, createFile, deleteFile, renameFile } from '../reducers/files';
import { performGistLoad } from '../reducers/output/gist';
import { Channel, Code, Edition, Mode } from '../types';
import { textChangedSinceShareSelector } from './gist';

type State = ReturnType<typeof reducer>;

const gistLoad = (code: Code) => {
  const arg = {
    id: 'id',
    url: 'url',
    code,
    stdout: 'stdout',
    stderr: 'stderr',
    channel: Channel.Stable,
    mode: Mode.Debug,
    edition: Edition.Rust2018,
  };
  return performGistLoad.fulfilled(arg, 'request-id', arg);
};

const reduceAll = (actions: UnknownAction[]): State => actions.reduce(reducer, undefined)!;

describe('checking if the code has changed since it was shared', () => {
  describe('string code, string gist', () => {
    test('unchanged', () => {
      const state = reduceAll([changeFileView('single'), gistLoad('code'), editCode('code')]);

      expect(textChangedSinceShareSelector(state)).toBe(false);
    });

    test('changed', () => {
      const state = reduceAll([
        changeFileView('single'),
        gistLoad('gist code'),
        editCode('editor code'),
      ]);

      expect(textChangedSinceShareSelector(state)).toBe(true);
    });
  });

  describe('array code, array gist', () => {
    test('unchanged', () => {
      const state = reduceAll([
        featureFlagsForceEnableAll(),
        changeFileView('multiple'),
        gistLoad([
          { name: 'file1', content: 'file1content' },
          { name: 'file2', content: 'file2content' },
        ]),
      ]);

      expect(textChangedSinceShareSelector(state)).toBe(false);
    });

    test('changed content', () => {
      const state = reduceAll([
        featureFlagsForceEnableAll(),
        changeFileView('multiple'),
        gistLoad([
          { name: 'file1', content: 'file1content' },
          { name: 'file2', content: 'file2content gist' },
        ]),
        activateFile('file2'),
        editCode('file2content editor'),
      ]);

      expect(textChangedSinceShareSelector(state)).toBe(true);
    });

    test('changed filename', () => {
      const state = reduceAll([
        featureFlagsForceEnableAll(),
        changeFileView('multiple'),
        gistLoad([
          { name: 'file1', content: 'file1content' },
          { name: 'file2', content: 'file2content' },
        ]),
        renameFile({ from: 'file2', to: 'file3' }),
      ]);

      expect(textChangedSinceShareSelector(state)).toBe(true);
    });

    test('added file', () => {
      const state = reduceAll([
        featureFlagsForceEnableAll(),
        changeFileView('multiple'),
        gistLoad([{ name: 'file1', content: 'file1content' }]),
        createFile('file2'),
        editCode('file2content'),
      ]);

      expect(textChangedSinceShareSelector(state)).toBe(true);
    });

    test('removed file', () => {
      const state = reduceAll([
        featureFlagsForceEnableAll(),
        changeFileView('multiple'),
        gistLoad([
          { name: 'file1', content: 'file1content' },
          { name: 'file2', content: 'file2content' },
        ]),
        deleteFile('file2'),
      ]);

      expect(textChangedSinceShareSelector(state)).toBe(true);
    });
  });
});
