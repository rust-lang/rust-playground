export interface Crate {
  id: string,
  name: string,
  version: string,
};

export interface CommonEditorProps {
  code: string,
  execute: () => any,
  onEditCode: (string) => any,
  position: {
    line: number,
    column: number,
  },
  crates: Crate[],
};

export enum Channel {
  Stable = "stable",
  Beta = "beta",
  Nightly = "nightly",
};
