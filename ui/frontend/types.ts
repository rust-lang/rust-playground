export interface Position {
  line: number,
  column: number,
};

export interface Crate {
  id: string,
  name: string,
  version: string,
};

export interface CommonEditorProps {
  code: string,
  execute: () => any,
  onEditCode: (string) => any,
  position: Position,
  crates: Crate[],
};

export enum Editor {
  Simple = "simple",
  Advanced = "advanced",
};

export enum Orientation {
  Automatic = "automatic",
  Horizontal = "horizontal",
  Vertical = "vertical",
};

export enum AssemblyFlavor {
  Att = "att",
  Intel = "intel",
};

export enum Channel {
  Stable = "stable",
  Beta = "beta",
  Nightly = "nightly",
};

export enum Mode {
  Debug = "debug",
  Release = "release",
};
