import * as codeRules from './filesRules';

describe('manipulating filenames', () => {
  test('building a file tree', () => {
    const r = codeRules.filenamesToTree(['a.rs', 'a/b/c/d/e.rs']);
    expect(r).toEqual([
      codeRules.makeFilePath('a.rs'),
      codeRules.makeDirPath('a'),
      codeRules.makeDirPath('a/b'),
      codeRules.makeDirPath('a/b/c'),
      codeRules.makeDirPath('a/b/c/d'),
      codeRules.makeFilePath('a/b/c/d/e.rs'),
    ]);
  });

  test('default selection when editing filenames', () => {
    const getSelection = (n: string) => codeRules.defaultSelection(n);

    expect(getSelection('alpha')).toEqual([0, 5]);
    expect(getSelection('alpha.rs')).toEqual([0, 5]);
    expect(getSelection('alpha.rs.bak')).toEqual([0, 5]);
    expect(getSelection('foo/bar.rs')).toEqual([4, 7]);
    expect(getSelection('foo/bar/baz.rs')).toEqual([8, 11]);
  });

  test('detects duplicate filenames', () => {
    const files = ['src/main.rs'];

    const result = codeRules.validateFilename(files, 'src/main.rs');
    expect(result).toEqual({ kind: 'file-duplicate', value: 'src/main.rs' });
  });

  test('rejects paths with empty components (double slash)', () => {
    const files: string[] = [];

    const result = codeRules.validateFilename(files, 'foo//bar.rs');
    expect(result).toEqual({ kind: 'dir-empty-component' });
  });

  test('rejects paths with leading slash', () => {
    const files: string[] = [];

    const result = codeRules.validateFilename(files, '/absolute/path.rs');
    expect(result).toEqual({ kind: 'dir-leading-slash' });
  });

  test('rejects dot files', () => {
    const files: string[] = [];

    const expectFail = (name: string) => {
      const result = codeRules.validateFilename(files, name);
      expect(result).toEqual({ kind: 'file-dotfile' });
    };

    expectFail('.');
    expectFail('..');
    expectFail('.cargo');
  });

  test('rejects a root `Cargo.toml`', () => {
    const files: string[] = [];

    const result = codeRules.validateFilename(files, 'Cargo.toml');
    expect(result).toEqual({ kind: 'file-cargo-toml' });
  });

  test('creating a file when it exists as a directory', () => {
    const files: string[] = ['src/main.rs'];

    const result = codeRules.validateFilename(files, 'src');
    expect(result).toEqual({ kind: 'file-dir-conflict' });
  });

  test('creating a directory when it exists as a file', () => {
    const files: string[] = ['src'];

    const result = codeRules.validateFilename(files, 'src/main.rs');
    expect(result).toEqual({ kind: 'file-dir-conflict' });
  });

  test('renaming a directory to an invalid filename', () => {
    const files = ['a/main.rs'];

    const r = codeRules.validateDirRename(files, { from: 'a', to: '.foo' });
    expect(r).toEqual({ kind: 'file-dotfile' });
  });

  test('renaming a directory that would clobber files', () => {
    const files = ['a/main.rs', 'b/main.rs'];

    const r = codeRules.validateDirRename(files, { from: 'a', to: 'b' });
    expect(r).toEqual({ kind: 'dir-duplicate', value: 'b/main.rs' });
  });
});
