interface Success<T> {
  readonly ok: true;
  readonly value: T;
}

interface Failure<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Success<T> | Failure<E>;

export const arrayIsPrefix = (needle: string[], haystack: string[]): boolean => {
  if (haystack.length < needle.length) {
    return false;
  }

  for (let i = 0; i < needle.length; i++) {
    const n = needle[i];
    const h = haystack[i];

    if (n !== h) {
      return false;
    }
  }

  return true;
};

interface CommonPath {
  readonly absolute: string;
  readonly parts: string[];
  readonly parentNames: string[];
  readonly name: string;
}

const makeCommonPathFromParts = (parts: string[]): CommonPath => ({
  parts,
  get absolute(): string {
    return this.parts.join('/');
  },
  get parentNames(): string[] {
    return this.parts.slice(0, -1);
  },
  get name(): string {
    return this.parts[this.parts.length - 1];
  },
});

const makeCommonPath = (absolute: string): CommonPath => {
  return makeCommonPathFromParts(absolute.split('/'));
};

export type FilePath = CommonPath & { readonly kind: 'file' };
export type DirPath = CommonPath & { readonly kind: 'dir' };
export type Path = FilePath | DirPath;

export const makeFilePath = (absolute: string): FilePath => {
  const path = makeCommonPath(absolute);
  return { kind: 'file', ...path };
};

export const makeDirPath = (absolute: string): DirPath => {
  const path = makeCommonPath(absolute);
  return { kind: 'dir', ...path };
};

function* parentsFromRoot(path: Path): Generator<DirPath> {
  for (let i = 0; i < path.parts.length - 1; i++) {
    const parts = path.parts.slice(0, i + 1);
    yield { kind: 'dir', ...makeCommonPathFromParts(parts) };
  }
}

export const filenamesToTree = (names: string[]): Path[] => {
  const myNames = [...names];
  myNames.sort((a, b) => a.localeCompare(b));

  const files: Path[] = [];
  const addedDirs = new Set();

  for (const absoluteName of myNames) {
    const filePath = makeFilePath(absoluteName);

    for (const parentDir of parentsFromRoot(filePath)) {
      if (!addedDirs.has(parentDir.absolute)) {
        addedDirs.add(parentDir.absolute);
        files.push(parentDir);
      }
    }

    files.push(filePath);
  }

  return files;
};

type FilePathError =
  | { kind: 'file-cargo-toml' }
  | { kind: 'file-playground-toml' }
  | { kind: 'file-dotfile' }
  | { kind: 'file-empty-name' }
  | { kind: 'dir-leading-slash' }
  | { kind: 'dir-empty-component' };

const makeValidatedFilePath = (absolute: string): Result<FilePath, FilePathError> => {
  const path = makeFilePath(absolute);

  if (path.name === '') {
    return { ok: false, error: { kind: 'file-empty-name' } };
  }

  if (path.parts[0] === '') {
    return { ok: false, error: { kind: 'dir-leading-slash' } };
  }

  for (const parentName of path.parentNames) {
    if (parentName === '') {
      return { ok: false, error: { kind: 'dir-empty-component' } };
    }
  }

  if (path.parts.some((n) => n.startsWith('.'))) {
    return { ok: false, error: { kind: 'file-dotfile' } };
  }

  const hasTopLevelFile = (name: string) => path.parentNames.length === 0 && path.name === name;

  if (hasTopLevelFile('Cargo.toml')) {
    return { ok: false, error: { kind: 'file-cargo-toml' } };
  }

  if (hasTopLevelFile('Playground.toml')) {
    return { ok: false, error: { kind: 'file-playground-toml' } };
  }

  return { ok: true, value: path };
};

export type FilePathInError =
  { kind: 'file-duplicate'; value: string } | { kind: 'file-dir-conflict' } | FilePathError;

const makeValidatedFilePathIn = (
  files: string[],
  absolute: string,
): Result<FilePath, FilePathInError> => {
  const r = makeValidatedFilePath(absolute);
  if (!r.ok) {
    return r;
  }
  const path = r.value;

  for (const file of files) {
    const fp = makeFilePath(file);

    if (fp.absolute === path.absolute) {
      return { ok: false, error: { kind: 'file-duplicate', value: file } };
    }

    if (arrayIsPrefix(path.parts, fp.parts) || arrayIsPrefix(fp.parts, path.parts)) {
      return { ok: false, error: { kind: 'file-dir-conflict' } };
    }
  }

  return { ok: true, value: path };
};

export const validateFilename = (files: string[], absolute: string): FilePathInError | null => {
  const p = makeValidatedFilePathIn(files, absolute);
  return p.ok ? null : p.error;
};

export interface Rename {
  from: string;
  to: string;
}

// If the path begins with the `from` directory, it will be replaced
// with the `to` directory. Otherwise, the path is returned unchanged.
const makePerformDirRename = ({ from, to }: Rename) => {
  const fromPath = makeCommonPath(from);
  const toPath = makeCommonPath(to);

  return (s: string): string => {
    const path = makeCommonPath(s);

    if (arrayIsPrefix(fromPath.parts, path.parentNames)) {
      const newParts = [...toPath.parts, ...path.parts.slice(fromPath.parts.length)];
      const newPath = makeCommonPathFromParts(newParts);
      return newPath.absolute;
    } else {
      return s;
    }
  };
};

export type DirInError = { kind: 'dir-duplicate'; value: string } | FilePathError;

export const makeValidatedDirRenamer = (
  files: string[],
  rename: Rename,
): Result<(s: string) => string, DirInError> => {
  const renamer = makePerformDirRename(rename);

  const set = new Set();

  for (const file of files) {
    const newName = renamer(file);
    if (set.has(newName)) {
      return { ok: false, error: { kind: 'dir-duplicate', value: newName } };
    }
    set.add(newName);

    const r = makeValidatedFilePath(newName);
    if (!r.ok) {
      return r;
    }
  }

  return { ok: true, value: renamer };
};

export const validateDirRename = (files: string[], rename: Rename): DirInError | null => {
  const r = makeValidatedDirRenamer(files, rename);
  return r.ok ? null : r.error;
};

export const defaultSelection = (name: string): [number, number] => {
  const path = makeCommonPath(name);

  const parentLength = path.parentNames.reduce((sum, n) => sum + n.length, 0);
  const slashesLength = path.parentNames.length * '/'.length;
  const startPos = parentLength + slashesLength;

  const endOffset = filenameDotIndex(path.name);
  const endPos = startPos + endOffset;

  return [startPos, endPos];
};

const filenameDotIndex = (name: string): number => {
  const dotOffset = name.indexOf('.');
  return dotOffset === -1 ? name.length : dotOffset;
};

export const filenameSplitAtDot = (name: string): [string, string] => {
  const index = filenameDotIndex(name);
  return [name.substring(0, index), name.substring(index)];
};
