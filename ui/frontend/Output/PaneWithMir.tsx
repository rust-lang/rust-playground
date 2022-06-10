import React from 'react';

import Header from './Header';
import SimplePane, { SimplePaneProps } from './SimplePane';
import OutputPrism from './OutputPrism';

interface PaneWithMirProps extends SimplePaneProps {
  code?: string;
}

const PaneWithMir: React.FC<PaneWithMirProps> = ({ code, ...rest }) => (
  <SimplePane {...rest}>
    <div data-test-id="output-result">
      <Header label="Result" />
      <OutputPrism languageCode="language-rust_mir">
        {code}
      </OutputPrism>
    </div>
  </SimplePane>
);

export default PaneWithMir;
