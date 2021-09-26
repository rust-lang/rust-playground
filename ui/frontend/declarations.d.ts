declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module 'prismjs/themes/*.css' {
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
  __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: any;
  rustPlayground: {
    setCode(code: string): void;
  };
}
