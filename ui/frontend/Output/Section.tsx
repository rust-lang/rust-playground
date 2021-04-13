import React from 'react';

import Header from './Header';

import styles from './Section.module.css';

interface SectionProps {
  kind: string;
  label: string;
}

const Section: React.SFC<SectionProps> = ({ kind, label, children }) => (
  children && (
    <div data-test-id={`output-${kind}`}>
      <Header label={label} />
      <pre><code className={styles.code}>{children}</code></pre>
    </div>
  )
);

export default Section;
