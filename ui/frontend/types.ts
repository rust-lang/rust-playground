export type Page = 'index' | 'help';

export interface Position {
  line: number;
  column: number;
}

export interface Crate {
  id: string;
  name: string;
  version: string;
}

export interface Version {
  version: string;
  hash: string;
  date: string;
}

export interface CommonEditorProps {
  code: string;
  execute: () => any;
  onEditCode: (_: string) => any;
  position: Position;
  crates: Crate[];
}

export enum Editor {
  Simple = 'simple',
  Advanced = 'advanced',
}

export enum Orientation {
  Automatic = 'automatic',
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

export enum AssemblyFlavor {
  Att = 'att',
  Intel = 'intel',
}

export enum DemangleAssembly {
  Demangle = 'demangle',
  Mangle = 'mangle',
}

export enum ProcessAssembly {
  Filter = 'filter',
  Raw = 'raw',
}

export enum Channel {
  Stable = 'stable',
  Beta = 'beta',
  Nightly = 'nightly',
}

export enum Mode {
  Debug = 'debug',
  Release = 'release',
}
