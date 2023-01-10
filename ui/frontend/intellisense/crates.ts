
export const downloadCodeOfCrate = async (crateName: string, version: string) => {
  return (await fetch(`/assets/crate-src/${crateName}_${version}.rs`)).text();
};

export const availableCrates = async (): Promise<{ [crate: string]: string[] }> => {
  return (await fetch('/assets/crate-src/index.json')).json();
};

const storageKey = 'intellisense-crates';

const selectedCrates = (): { [crate: string]: string | undefined } => {
  const x = localStorage.getItem(storageKey);
  if (!x) {
    localStorage.setItem(storageKey, '{}');
    return {};
  }
  return JSON.parse(x);
};

export const availableVersions = async (crateName: string): Promise<{
  selected: string | undefined,
  others: string[],
}> => {
  const v = (await availableCrates())[crateName];
  const selected = selectedCrates()[crateName];
  return {
    selected,
    others: v.filter((x) => x !== selected),
  };
};

export const selectVersion = (crateName: string, version: string) => {
  const c = selectedCrates();
  c[crateName] = version;
  localStorage.setItem(storageKey, JSON.stringify(c));
};

export const selectedVersion = async (crateName: string): Promise<string> => {
  const current = selectedCrates()[crateName];
  if (selectedCrates()[crateName]) {
    return current;
  }
  const r = (await availableCrates())[crateName][0];
  selectVersion(crateName, r);
  return r;
};
