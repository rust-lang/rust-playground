import React from 'react';
import { PrismCode } from 'react-prism';

import Header from './Header';
import Loader from './Loader';
import Section from './Section';

interface HighlightErrorsProps {
  label: string;
}

const HighlightErrors: React.SFC<HighlightErrorsProps> = ({ label, children }) => (
  <div className="output-stderr">
    <Header label={label} />
    <pre>
      <PrismCode className="language-rust_errors">
        {children}
      </PrismCode>
    </pre>
  </div>
);

export interface SimplePaneProps extends ReallySimplePaneProps {
  kind: string;
}

export interface ReallySimplePaneProps {
  requestsInProgress: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

const SimplePane: React.SFC<SimplePaneProps> = props => (
  <div className={`output-${props.kind}`}>
    {(props.requestsInProgress > 0) && <Loader />}
    <Section kind="error" label="Errors">{props.error}</Section>
    <HighlightErrors label="Standard Error">{props.stderr}</HighlightErrors>
    <Section kind="stdout" label="Standard Output">{props.stdout}</Section>
    {props.children}
  </div>
);

export default SimplePane;
