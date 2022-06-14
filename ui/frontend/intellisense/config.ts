const storageKey = 'intellisence';

type Config = {
  enable: boolean,
  suggest: boolean,
  diagnostic: boolean,
};

export const setConfig = (x: Config) => {
  window.localStorage.setItem(storageKey, JSON.stringify(x));
};

export const getIntellisenseConfig = (): Config => {
  const v = window.localStorage.getItem(storageKey);
  if (!v) {
    setConfig({
      enable: false,
      suggest: true,
      diagnostic: false,
    });
    return getIntellisenseConfig();
  }
  return JSON.parse(v);
};

export const isEnable = (): boolean => {
  return getIntellisenseConfig().enable;
};

export const enableIntellisense = () => {
  setConfig({
    ...getIntellisenseConfig(),
    enable: true,
    suggest: false,
  });
  window.location.reload();
};

