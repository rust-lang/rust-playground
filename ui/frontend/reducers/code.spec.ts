import reducer, { addImport, doAddImport, editSingleCode } from './code';

const IMPORT = 'use std::collections::HashMap;\n';

describe('adding an import', () => {
  test('without inner attributes it goes at the top', () => {
    const code = 'fn main() {}\n';

    expect(doAddImport(code, IMPORT)).toEqual(`${IMPORT}fn main() {}\n`);
  });

  test('it goes after inner attributes', () => {
    const code = '#![no_std]\n#![feature(never_type)]\n\nfn main() {}\n';

    expect(doAddImport(code, IMPORT)).toEqual(
      `#![no_std]\n#![feature(never_type)]\n${IMPORT}\nfn main() {}\n`,
    );
  });

  test('it goes after multi-line inner attributes', () => {
    const code = '#![feature(\n    never_type,\n    let_chains,\n)]\nfn main() {}\n';

    expect(doAddImport(code, IMPORT)).toEqual(
      `#![feature(\n    never_type,\n    let_chains,\n)]\n${IMPORT}fn main() {}\n`,
    );
  });

  test('it goes after inner doc comments and skips other comments', () => {
    const code = '//! Crate docs\n// A comment\n#![allow(dead_code)]\nfn main() {}\n';

    expect(doAddImport(code, IMPORT)).toEqual(
      `//! Crate docs\n// A comment\n#![allow(dead_code)]\n${IMPORT}fn main() {}\n`,
    );
  });

  test('it does not move past outer attributes', () => {
    const code = '#![no_std]\n#[derive(Debug)]\nstruct Foo;\n';

    expect(doAddImport(code, IMPORT)).toEqual(
      `#![no_std]\n${IMPORT}#[derive(Debug)]\nstruct Foo;\n`,
    );
  });

  test('it handles code without a trailing newline', () => {
    const code = '#![no_std]';

    expect(doAddImport(code, IMPORT)).toEqual(`#![no_std]\n${IMPORT}`);
  });

  test('the reducer uses the same placement', () => {
    let state = reducer(undefined, editSingleCode('#![no_std]\nfn main() {}\n'));
    state = reducer(state, addImport(IMPORT));

    expect(state).toEqual(`#![no_std]\n${IMPORT}fn main() {}\n`);
  });
});
