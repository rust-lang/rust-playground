import React from 'react';
import { connect } from 'react-redux';

import { PrismCode } from "react-prism";
import "prismjs/components/prism-rust.min";

import { showExample } from './actions';

const Example: React.SFC<Props> = ({ code, showExample }) => (
  <pre className="help__example">
    <button className="help__load_example" onClick={() => showExample(code)}>
      Load in playground
    </button>
    <PrismCode className="language-rust">
      {code}
    </PrismCode>
  </pre>
);

export interface Props {
  code: string,
  showExample: (code: string) => any,
};

const mapDispatchToProps = ({
  showExample,
});

export default connect(null, mapDispatchToProps)(Example);
