import React from 'react';

type ForwardRefRender<Props, Element> = (props: Props, ref: React.Ref<Element>) => React.ReactNode;

declare module 'react' {
  // Introduced with React 16.3
  // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/24624/files
  function forwardRef<Props, Element>(render: ForwardRefRender<Props, Element>);
}
