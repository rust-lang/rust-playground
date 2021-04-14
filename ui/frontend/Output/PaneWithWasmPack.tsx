import React from 'react';
import { PrismCode } from 'react-prism';

import Header from './Header';
import SimplePane, { SimplePaneProps } from './SimplePane';

interface PaneWithWasmPackProps extends SimplePaneProps {
  wasm_js?: string;
  wasm_bg?: string;
}

const PaneWithWasmPack: React.SFC<PaneWithWasmPackProps> = ({wasm_js, wasm_bg, error , ...rest }) => (
  <SimplePane {...rest}>
    <div className="output-result">
      <Header label="Result" />
      <pre>
        <PrismCode className="language-rust_mir">
          {wasm_js}
          {wasm_bg}
        </PrismCode>
      </pre>
    </div>
  </SimplePane>
);

export default PaneWithWasmPack;
