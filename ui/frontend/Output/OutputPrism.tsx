import React from 'react';
import { PrismCode } from 'react-prism';

import styles from './OutputPrism.module.css';

interface OutputPrismProps {
  children: React.ReactNode;
  languageCode: 'language-rust_mir' | 'language-rust_errors';
}

const OutputPrism: React.FC<OutputPrismProps> = ({ languageCode, children }) => (
  <pre>
    <PrismCode className={`${styles.container} ${languageCode}`}>
      {children}
    </PrismCode>
  </pre>
);

export default OutputPrism;
