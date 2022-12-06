export type Page = 'index' | 'help';

export interface Position {
  line: number;
  column: number;
}

export const makePosition = (line: string | number, column: string | number): Position =>
  ({ line: +line, column: +column });

export interface Selection {
  start?: Position;
  end?: Position;
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
  selection: Selection;
  crates: Crate[];
}

export enum Editor {
  Simple = 'simple',
  Ace = 'ace',
  Monaco = 'monaco',
}

export enum PairCharacters {
  Enabled = 'enabled',
  Disabled = 'disabled',
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
  Hir = 'hir',
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
  Rust2021 = '2021',
}

export enum Backtrace {
  Disabled = 'disabled',
  Enabled = 'enabled',
}

export enum Focus {
  Clippy = 'clippy',
  Miri = 'miri',
  MacroExpansion = 'macro-expansion',
  LlvmIr = 'llvm-ir',
  Mir = 'mir',
  Hir = 'hir',
  Wasm = 'wasm',
  Asm = 'asm',
  Execute = 'execute',
  Format = 'format',
  Gist = 'gist',
}

export enum Notification {
  RustSurvey2022 = 'rust-survey-2022',
}

export type AceResizeKey = [Focus | undefined, number];
