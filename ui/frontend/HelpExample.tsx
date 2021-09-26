import React, { useCallback } from 'react';
import root from 'react-shadow';
import { useDispatch } from 'react-redux';

import 'prismjs/components/prism-rust.min';
import { PrismCode } from 'react-prism';

import * as actions from './actions';

import styles from './HelpExample.module.css';
import prismTheme from 'prismjs/themes/prism-okaidia.css';

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
    <div className={styles.container}>
      <button className={styles.loadExample} onClick={showExample}>
        Load in playground
      </button>
      <root.div>
        <link href={prismTheme} rel="stylesheet" />

        <pre>
          <PrismCode className="language-rust">
            {code}
          </PrismCode>
        </pre>
      </root.div>
    </div>
  );
};

export default HelpExample;
