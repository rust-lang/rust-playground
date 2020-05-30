import React from 'react';
import { PrismCode } from 'react-prism';

import Header from './Header';
import SimplePane, { SimplePaneProps } from './SimplePane';

interface PaneWithMirProps extends SimplePaneProps {
  code?: string;
}

const PaneWithMir: React.SFC<PaneWithMirProps> = ({ code, ...rest }) => (
  <SimplePane {...rest}>
    <div className="output-result">
      <Header label="Result" />
      <pre>
        <PrismCode className="language-rust_mir">
          {code}
        </PrismCode>
      </pre>
    </div>
  </SimplePane>
);

export default PaneWithMir;
