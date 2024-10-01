declare module '*.module.css' {
  const classes: { [key: string]: string };
  export = classes;
}

declare module 'prismjs/themes/*.css' {
  const content: string;
  export default content;
}

declare module '*prismjs-overrides.css' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare const ACE_KEYBINDINGS: string[];
declare const ACE_THEMES: string[];

interface Window {
  rustPlayground: {
    setCode(code: string): void;
    disableSyncChangesToStorage(): void;
  };
}
