import * as qs from 'qs';
import React from 'react';
import { PrismCode } from 'react-prism';
import { connect } from 'react-redux';

import { changeFocus } from './actions';
import { State } from './reducers';
import { State as OutputState } from './reducers/output';
import { Channel, Edition, Mode } from './types';

import Gist from './Output/Gist';
import Header from './Output/Header';
import MyLoader from './Output/Loader';

const hasProperties = obj => Object.values(obj).some(val => !!val);

const Tab: React.SFC<TabProps> = ({ kind, focus, label, onClick, tabProps }) => {
  if (hasProperties(tabProps)) {
    const selected = focus === kind ? 'output-tab-selected' : '';
    return (
      <button className={`output-tab ${selected}`}
        onClick={onClick}>
        {label}
      </button>
    );
  } else {
    return null;
  }
};

interface TabProps {
  kind: string;
  focus?: string;
  label: string;
  onClick: () => any;
  tabProps: object;
}

const Section: React.SFC<SectionProps> = ({ kind, label, children }) => {
  if (children) {
    return (
      <div className={`output-${kind}`}>
        <Header label={label} />
        <pre><code>{children}</code></pre>
      </div>
    );
  } else {
    return null;
  }
};

interface SectionProps {
  kind: string;
  label: string;
}

class HighlightErrors extends React.PureComponent<HighlightErrorsProps> {
  public render() {
    const { label, children } = this.props;

    return (
      <div className="output-stderr">
        <Header label={label} />
        <pre>
          <PrismCode className="language-rust_errors">
            {children}
          </PrismCode>
        </pre>
      </div>
    );
  }
}

interface HighlightErrorsProps {
  label: string;
}

const SimplePane: React.SFC<SimplePaneProps> = ({
  focus, kind, requestsInProgress, stdout, stderr, error, children,
}) => {
  if (focus === kind) {
    const loader = (requestsInProgress > 0) ? <MyLoader /> : null;
    return (
      <div className={`output-${kind}`}>
        {loader}
        <Section kind="error" label="Errors">{error}</Section>
        <HighlightErrors label="Standard Error">{stderr}</HighlightErrors>
        <Section kind="stdout" label="Standard Output">{stdout}</Section>
        {children}
      </div>
    );
  } else {
    return null;
  }
};

interface SimplePaneProps extends SimpleProps {
  focus: string;
  kind: string;
}

const PaneWithCode: React.SFC<PaneWithCodeProps> = ({ code, ...rest }) => (
  <SimplePane {...rest}>
    <Section kind="code" label="Result">{code}</Section>
  </SimplePane>
);

interface PaneWithCodeProps extends SimplePaneProps {
  code?: string;
}

const Format: React.SFC<FormatProps> = ({ focus, requestsInProgress }) => {
  if (focus === 'format') {
    const loader = (requestsInProgress > 0) ? <MyLoader /> : null;

    return (
      <div className="output-format">
        {loader}
      </div>
    );
  } else {
    return null;
  }
};

interface FormatProps {
  focus: string;
  requestsInProgress: number;
}

class Output extends React.PureComponent<OutputProps> {
  private focusClose = () => this.props.changeFocus(null);
  private focusExecute = () => this.props.changeFocus('execute');
  private focusFormat = () => this.props.changeFocus('format');
  private focusClippy = () => this.props.changeFocus('clippy');
  private focusAssembly = () => this.props.changeFocus('asm');
  private focusLlvmIr = () => this.props.changeFocus('llvm-ir');
  private focusMir = () => this.props.changeFocus('mir');
  private focusWasm = () => this.props.changeFocus('wasm');
  private focusGist = () => this.props.changeFocus('gist');

  public render() {
    const {
      meta: { focus }, execute, format, clippy, assembly, llvmIr, mir, wasm, gist,
    } = this.props;

    const somethingToShow = [execute, format, clippy, assembly, llvmIr, mir, wasm, gist].some(hasProperties);

    if (!somethingToShow) {
      return null;
    }

    let close = null;
    let body = null;
    if (focus) {
      close = (
        <button className="output-tab output-tab-close"
          onClick={this.focusClose}>Close</button>
      );

      body = (
        <div className="output-body">
          <SimplePane {...execute} kind="execute" focus={focus} />
          <Format {...format} focus={focus} />
          <SimplePane {...clippy} kind="clippy" focus={focus} />
          <PaneWithCode {...assembly} kind="asm" focus={focus} />
          <PaneWithCode {...llvmIr} kind="llvm-ir" focus={focus} />
          <PaneWithCode {...mir} kind="mir" focus={focus} />
          <PaneWithCode {...wasm} kind="wasm" focus={focus} />
          {focus === 'gist' && <Gist />}
        </div>
      );
    }

    return (
      <div className="output">
        <div className="output-tabs">
          <Tab kind="execute" focus={focus}
            label="Execution"
            onClick={this.focusExecute}
            tabProps={execute} />
          <Tab kind="format" focus={focus}
            label="Format"
            onClick={this.focusFormat}
            tabProps={format} />
          <Tab kind="clippy" focus={focus}
            label="Clippy"
            onClick={this.focusClippy}
            tabProps={clippy} />
          <Tab kind="asm" focus={focus}
            label="ASM"
            onClick={this.focusAssembly}
            tabProps={assembly} />
          <Tab kind="llvm-ir" focus={focus}
            label="LLVM IR"
            onClick={this.focusLlvmIr}
            tabProps={llvmIr} />
          <Tab kind="mir" focus={focus}
            label="MIR"
            onClick={this.focusMir}
            tabProps={mir} />
          <Tab kind="wasm" focus={focus}
            label="WASM"
            onClick={this.focusWasm}
            tabProps={wasm} />
          <Tab kind="gist" focus={focus}
            label="Share"
            onClick={this.focusGist}
            tabProps={gist} />
          {close}
        </div>
        {body}
      </div>
    );
  }
}

interface SimpleProps {
  requestsInProgress: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

interface WithCodeProps extends SimpleProps {
  code: string;
}

interface OutputProps extends OutputState {
  changeFocus: (_?: string) => any;
}

const mapStateToProps = (state: State) => state.output;

const mapDispatchToProps = ({
  changeFocus,
});

const ConnectedOutput = connect(
  mapStateToProps,
  mapDispatchToProps,
)(Output);

export default ConnectedOutput;
