import reducer from '../reducers';
import { editCode } from '../reducers/code';
import { hasAssemblySymbolsSelector, hasMainFunctionSelector } from './index';

const buildState = (code: string) => reducer(undefined, editCode(code));

const doMainFunctionSelector = (code: string) => hasMainFunctionSelector(buildState(code));

describe('checking for a main function', () => {
  test('empty code has no main', () => {
    expect(doMainFunctionSelector('')).toBe(false);
  });

  test('a plain main counts', () => {
    expect(doMainFunctionSelector('fn main()')).toBe(true);
  });

  test('a public main counts', () => {
    expect(doMainFunctionSelector('pub fn main()')).toBe(true);
  });

  test('an async main counts', () => {
    expect(doMainFunctionSelector('async fn main()')).toBe(true);
  });

  test('a public async main counts', () => {
    expect(doMainFunctionSelector('pub async fn main()')).toBe(true);
  });

  test('a const main counts', () => {
    expect(doMainFunctionSelector('const fn main()')).toBe(true);
  });

  test('a public const main counts', () => {
    expect(doMainFunctionSelector('pub const fn main()')).toBe(true);
  });

  test('a public const async main counts', () => {
    expect(doMainFunctionSelector('pub const async fn main()')).toBe(true);
  });

  test('leading indentation is ignored', () => {
    expect(doMainFunctionSelector('\t fn main()')).toBe(true);
  });

  test('extra space everywhere is ignored', () => {
    expect(doMainFunctionSelector('  pub async   fn  main  (  )')).toBe(true);
  });

  test('a commented-out main does not count', () => {
    expect(doMainFunctionSelector('// fn main()')).toBe(false);
    expect(doMainFunctionSelector('/* fn main()')).toBe(false);
  });

  test('a function with the substring main does not count', () => {
    expect(doMainFunctionSelector('fn mainly()')).toBe(false);
  });

  test('a main function after other items on the same line', () => {
    expect(doMainFunctionSelector('use std; fn main(){ println!("Hello, world!"); }')).toBe(true);
  });

  test('a main function with a block comment in the argument list', () => {
    expect(doMainFunctionSelector('fn main(/* comment */) {')).toBe(true);
  });
});

const doHasAssemblySymbolSelector = (code: string) => {
  const state = reducer(
    { output: { assembly: { code, requestsInProgress: 0 } } },
    { type: 'test' },
  );
  return hasAssemblySymbolsSelector(state);
};

describe('checking for symbols in assembly output', () => {
  test('empty code has no symbols', () => {
    expect(doHasAssemblySymbolSelector('')).toBe(false);
  });

  test('instructions are not symbols', () => {
    // x86_64
    expect(doHasAssemblySymbolSelector('    	movl	%edi, 4(%rsp)')).toBe(false);
    // arm
    expect(doHasAssemblySymbolSelector('	sub	sp, sp, #32')).toBe(false);
  });

  test('mangled symbols are symbols', () => {
    expect(doHasAssemblySymbolSelector('_ZN10playground3add17h903bea7e047dfb9fE:')).toBe(true);
  });

  test('unmangled symbols are symbols', () => {
    expect(doHasAssemblySymbolSelector('playground::add:')).toBe(true);
  });

  test('unmangled symbols from traits are symbols', () => {
    expect(
      doHasAssemblySymbolSelector(
        '<rand::rngs::reseeding::ReseedingCore<R,Rsdr> as rand_core::block::BlockRngCore>::generate:',
      ),
    ).toBe(true);
  });

  test('symbols with comments are symbols', () => {
    // x86_64
    expect(doHasAssemblySymbolSelector('add:                                    # @add')).toBe(
      true,
    );
    // arm
    expect(doHasAssemblySymbolSelector('add:                                    // @add')).toBe(
      true,
    );
  });
});
