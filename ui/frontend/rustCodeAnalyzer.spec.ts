import fs from 'node:fs/promises';

import { RUST_LANGUAGE_URL, buildAnalyzer } from './rustCodeAnalyzer';

const analyzer = await buildAnalyzer({
  getRustLangModuleBytes: () => fs.readFile(RUST_LANGUAGE_URL.pathname),
});

const hasMainFunction = (code: string): boolean => analyzer(code).hasMain;

describe('checking for a main function', () => {
  test('empty code has no main', () => {
    expect(hasMainFunction('')).toBe(false);
  });

  test('a plain main counts', () => {
    expect(hasMainFunction('fn main() {}')).toBe(true);
  });

  test('a public main counts', () => {
    expect(hasMainFunction('pub fn main() {}')).toBe(true);
  });

  test('an async main counts', () => {
    expect(hasMainFunction('async fn main() {}')).toBe(true);
  });

  test('a public async main counts', () => {
    expect(hasMainFunction('pub async fn main() {}')).toBe(true);
  });

  test('a const main counts', () => {
    expect(hasMainFunction('const fn main() {}')).toBe(true);
  });

  test('a public const main counts', () => {
    expect(hasMainFunction('pub const fn main() {}')).toBe(true);
  });

  test('a public const async main counts', () => {
    expect(hasMainFunction('pub const async fn main() {}')).toBe(true);
  });

  test('leading indentation is ignored', () => {
    expect(hasMainFunction('\t fn main() {}')).toBe(true);
  });

  test('extra space everywhere is ignored', () => {
    expect(hasMainFunction('  pub async   fn  main  (  )  { }')).toBe(true);
  });

  test('a commented-out main does not count', () => {
    expect(hasMainFunction('// fn main() {}')).toBe(false);
    expect(hasMainFunction('/* fn main() {}')).toBe(false);
  });

  test('a main inside a multiline block comment does not count', () => {
    expect(hasMainFunction('/*\nfn main() {}\n*/')).toBe(false);
  });

  test('a main inside an unclosed block comment does not count', () => {
    expect(hasMainFunction('/*\nfn main() {}')).toBe(false);
  });

  test('a main after a multiline block comment counts', () => {
    expect(hasMainFunction('/* fn hidden() {} */\nfn main() {}')).toBe(true);
  });

  test('a main inside nested block comments does not count', () => {
    expect(hasMainFunction('/* outer\n/* inner */\nfn main() {}\n*/')).toBe(false);
  });

  test('block comment markers in strings do not hide a main', () => {
    expect(hasMainFunction('const marker: &str = "/*";\nfn main() {}')).toBe(true);
  });

  test('block comment markers in raw strings do not hide a main', () => {
    expect(hasMainFunction('const marker: &str = r#"/*"#;\nfn main() {}')).toBe(true);
  });

  test('a function with the substring main does not count', () => {
    expect(hasMainFunction('fn mainly()')).toBe(false);
  });

  test('a main function after other items on the same line', () => {
    expect(hasMainFunction('use std; fn main(){ println!("Hello, world!"); }')).toBe(true);
  });

  test('a main function with a block comment in the argument list', () => {
    expect(hasMainFunction('fn main(/* comment */) {}')).toBe(true);
  });

  test('a main function in a module does not count', () => {
    expect(hasMainFunction('mod inner { fn main() {} }')).toBe(false);
  });
});

const crateType = (code: string): string | undefined => analyzer(code).crateType;

describe('checking for a crate type', () => {
  test('empty code has no crate type', () => {
    expect(crateType('')).toBeUndefined();
  });

  test('regular attribute does not count', () => {
    expect(crateType('#[crate_type = "neat"]')).toBeUndefined();
  });

  test('inner attribute does count', () => {
    expect(crateType('#![crate_type = "neat"]')).toBe('neat');
  });

  test('inside a module does not count', () => {
    expect(crateType('mod inner { #![crate_type = "neat"] }')).toBeUndefined();
  });
});

const hasTests = (code: string): boolean => analyzer(code).hasTests;

describe('checking for tests', () => {
  test('empty code has no tests', () => {
    expect(hasTests('')).toBe(false);
  });

  test('looks at attributes', () => {
    expect(hasTests('#[test] fn foo() {}')).toBe(true);
  });

  test('looks inside of modules', () => {
    expect(hasTests('mod inner { #[test] fn foo() {} }')).toBe(true);
  });
});
