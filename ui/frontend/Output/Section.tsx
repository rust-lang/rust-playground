import React from 'react';

import Header from './Header';

interface SectionProps {
  kind: string;
  label: string;
}

const Section: React.SFC<SectionProps> = ({ kind, label, children }) => (
  children && (
    <div className={`output-${kind}`}>
      <Header label={label} />
      <pre><code>{children}</code></pre>
    </div>
  )
);

export default Section;
