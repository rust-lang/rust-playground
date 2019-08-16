declare module '*.svg' {
  const content: any;
  export default content;
}

declare const ACE_KEYBINDINGS: string[];
declare const ACE_THEMES: string[];

interface Window {
  __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: any;
  rustPlayground: {
    setCode(code: string): void;
  };
}
