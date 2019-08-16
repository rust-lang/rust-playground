import React, { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import 'prismjs/components/prism-rust.min';
import { PrismCode } from 'react-prism';

import * as actions from './actions';

export interface HelpExampleProps {
  code: string;
}

const HelpExample: React.SFC<HelpExampleProps> = ({ code }) => {
  const dispatch = useDispatch();
  const showExample = useCallback(
    () => dispatch(actions.showExample(code)),
    [dispatch, code]
  );

  return (
    <pre className="help__example">
      <button className="help__load_example" onClick={showExample}>
        Load in playground
      </button>
      <PrismCode className="language-rust">
        {code}
      </PrismCode>
    </pre>
  );
};

export default HelpExample;
