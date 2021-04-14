import React from 'react';

import Header from './Header';
import SimplePane, { SimplePaneProps } from './SimplePane';
import { FunctionalIFrameComponent } from './Container';

interface PaneWithWasmPackProps extends SimplePaneProps {
  wasm_js?: string;
  wasm_bg?: string;
}

function base64ToByteArray(src) {
  const decode = atob(src);
  const byteNumbers = new Array(decode.length);
  for (let i = 0; i < decode.length; i++) {
    byteNumbers[i] = decode.charCodeAt(i);
  }
  return new Uint8Array(byteNumbers);
}

function createObjectURL(src: ArrayBuffer | string, mime: string) {
  return URL.createObjectURL(new Blob([src], { type: mime }));
}

function createEntryJS(wasm_js, wasm_bg) {
  // window.console.log(`${error}, ${wasm_js}`)
  // if (error) {
  //   return null;
  // }
  const wasmJS = atob(wasm_js);
  const bgWasm = base64ToByteArray(wasm_bg);
  const wasmJSBlob = createObjectURL(wasmJS, 'application/javascript');
  const bgWasmBlob = createObjectURL(bgWasm, 'application/wasm');

  const entryJS = `
    import init from '${wasmJSBlob}';
    await init('${bgWasmBlob}');
  `;

  return createObjectURL(entryJS, 'application/javascript');
}

const Iframe: React.SFC<PaneWithWasmPackProps> = ({ wasm_js, wasm_bg, ...rest }) => (
  <SimplePane {...rest}>
    <div className="output-result">
      <Header label="Result" />
      <FunctionalIFrameComponent url={createEntryJS(wasm_js, wasm_bg)}>
      </FunctionalIFrameComponent>
    </div>
  </SimplePane>
);

export default Iframe;
