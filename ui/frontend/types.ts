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

export enum PrimaryActionAuto {
  Auto = 'auto',
}

export enum PrimaryActionCore {
  Asm = 'asm',
  Compile = 'compile',
  Execute = 'execute',
  LlvmIr = 'llvm-ir',
  Mir = 'mir',
  Test = 'test',
  Wasm = 'wasm',
}

export type PrimaryAction = PrimaryActionCore | PrimaryActionAuto;

export enum Channel {
  Stable = 'stable',
  Beta = 'beta',
  Nightly = 'nightly',
}

export enum Mode {
  Debug = 'debug',
  Release = 'release',
}

export enum Edition {
  Rust2015 = '2015',
  Rust2018 = '2018',
}

export enum Backtrace {
  Disabled = 'disabled',
  Enabled = 'enabled',
}

export enum Focus {
  Clippy = 'clippy',
  Miri = 'miri',
  LlvmIr = 'llvm-ir',
  Mir = 'mir',
  Wasm = 'wasm',
  Asm = 'asm',
  Execute = 'execute',
  Format = 'format',
  Gist = 'gist',
}

export enum Notification {
  Rust2018IsDefault = 'rust-2018-is-default',
}
