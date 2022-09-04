import { editCode } from '../actions';
import reducer from '../reducers';

import { hasMainFunctionSelector } from './index';

const buildState = (code: string) => {
  const state = reducer(undefined, editCode(code));
  return state;
};

describe('checking for a main function', () => {
  test('empty code has no main', () => {
    expect(hasMainFunctionSelector(buildState(''))).toBe(false);
  });

  test('a plain main counts', () => {
    expect(hasMainFunctionSelector(buildState('fn main()'))).toBe(true);
  });

  test('a public main counts', () => {
    expect(hasMainFunctionSelector(buildState('pub fn main()'))).toBe(true);
  });

  test('an async main counts', () => {
    expect(hasMainFunctionSelector(buildState('async fn main()'))).toBe(true);
  });

  test('a public async main counts', () => {
    expect(hasMainFunctionSelector(buildState('pub async fn main()'))).toBe(true);
  });

  test('a const main counts', () => {
    expect(hasMainFunctionSelector(buildState('const fn main()'))).toBe(true);
  });

  test('a public const main counts', () => {
    expect(hasMainFunctionSelector(buildState('pub const fn main()'))).toBe(true);
  });

  test('a public const async main counts', () => {
    expect(hasMainFunctionSelector(buildState('pub const async fn main()'))).toBe(true);
  });

  test('leading indentation is ignored', () => {
    expect(hasMainFunctionSelector(buildState('\t fn main()'))).toBe(true);
  });

  test('extra space everywhere is ignored', () => {
    expect(hasMainFunctionSelector(buildState('  pub async   fn  main  (  )'))).toBe(true);
  });

  test('a commented-out main does not count', () => {
    expect(hasMainFunctionSelector(buildState('// fn main()'))).toBe(false);
    expect(hasMainFunctionSelector(buildState('/* fn main()'))).toBe(false);
  });

  test('a function with the substring main does not count', () => {
    expect(hasMainFunctionSelector(buildState('fn mainly()'))).toBe(false);
  });
});
