import * as qs from 'qs';
import React from 'react';
import { PrismCode } from 'react-prism';
import { connect } from 'react-redux';

import { changeFocus } from './actions';
import { State } from './reducers';
import { State as OutputState } from './reducers/output';
import { Channel, Edition, Focus, Mode } from './types';

import Gist from './Output/Gist';
import Header from './Output/Header';
import MyLoader from './Output/Loader';
import { getSomethingToShow, hasProperties } from './selectors';

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
  kind: Focus;
  focus?: Focus;
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
  kind, requestsInProgress, stdout, stderr, error, children,
}) => {
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
};

interface SimplePaneProps extends SimpleProps {
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

const Format: React.SFC<FormatProps> = ({ requestsInProgress }) => {
  const loader = (requestsInProgress > 0) ? <MyLoader /> : null;

  return (
    <div className="output-format">
      {loader}
    </div>
  );
};

interface FormatProps {
  requestsInProgress: number;
}

const Output: React.SFC<OutputProps> = ({
  // https://github.com/palantir/tslint/issues/3960
  // tslint:disable-next-line:trailing-comma
  somethingToShow, meta: { focus }, execute, format, clippy, miri, assembly, llvmIr, mir, wasm, gist, ...props
}) => {
  if (!somethingToShow) {
    return null;
  }

  let close = null;
  let body = null;
  if (focus) {
    close = (
      <button className="output-tab output-tab-close"
        onClick={props.focusClose}>Close</button>
    );

    body = (
      <div className="output-body">
        {focus === Focus.Execute && <SimplePane {...execute} kind="execute" />}
        {focus === Focus.Format && <SimplePane {...format} kind="format" />}
        {focus === Focus.Clippy && <SimplePane {...clippy} kind="clippy" />}
        {focus === Focus.Miri && <SimplePane {...miri} kind="miri" />}
        {focus === Focus.Asm && <PaneWithCode {...assembly} kind="asm" />}
        {focus === Focus.LlvmIr && <PaneWithCode {...llvmIr} kind="llvm-ir" />}
        {focus === Focus.Mir && <PaneWithCode {...mir} kind="mir" />}
        {focus === Focus.Wasm && <PaneWithCode {...wasm} kind="wasm" />}
        {focus === Focus.Gist && <Gist />}
      </div>
    );
  }

  return (
    <div className="output">
      <div className="output-tabs">
        <Tab kind={Focus.Execute} focus={focus}
          label="Execution"
          onClick={props.focusExecute}
          tabProps={execute} />
        <Tab kind={Focus.Format} focus={focus}
          label="Format"
          onClick={props.focusFormat}
          tabProps={format} />
        <Tab kind={Focus.Clippy} focus={focus}
          label="Clippy"
          onClick={props.focusClippy}
          tabProps={clippy} />
        <Tab kind={Focus.Miri} focus={focus}
          label="Miri"
          onClick={props.focusMiri}
          tabProps={miri} />
        <Tab kind={Focus.Asm} focus={focus}
          label="ASM"
          onClick={props.focusAssembly}
          tabProps={assembly} />
        <Tab kind={Focus.LlvmIr} focus={focus}
          label="LLVM IR"
          onClick={props.focusLlvmIr}
          tabProps={llvmIr} />
        <Tab kind={Focus.Mir} focus={focus}
          label="MIR"
          onClick={props.focusMir}
          tabProps={mir} />
        <Tab kind={Focus.Wasm} focus={focus}
          label="WASM"
          onClick={props.focusWasm}
          tabProps={wasm} />
        <Tab kind={Focus.Gist} focus={focus}
          label="Share"
          onClick={props.focusGist}
          tabProps={gist} />
        {close}
      </div>
      {body}
    </div>
  );
};

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
  somethingToShow: boolean;
  changeFocus: (_?: Focus) => any;
  focusClose: () => void;
  focusExecute: () => void;
  focusFormat: () => void;
  focusClippy: () => void;
  focusMiri: () => void;
  focusAssembly: () => void;
  focusLlvmIr: () => void;
  focusMir: () => void;
  focusWasm: () => void;
  focusGist: () => void;
}

const mapStateToProps = (state: State) => ({
  somethingToShow: getSomethingToShow(state),
  ...state.output,
});

const mapDispatchToProps = ({
  focusClose: () => changeFocus(null),
  focusExecute: () => changeFocus(Focus.Execute),
  focusFormat: () => changeFocus(Focus.Format),
  focusClippy: () => changeFocus(Focus.Clippy),
  focusMiri: () => changeFocus(Focus.Miri),
  focusAssembly: () => changeFocus(Focus.Asm),
  focusLlvmIr: () => changeFocus(Focus.LlvmIr),
  focusMir: () => changeFocus(Focus.Mir),
  focusWasm: () => changeFocus(Focus.Wasm),
  focusGist: () => changeFocus(Focus.Gist),
});

const ConnectedOutput = connect(
  mapStateToProps,
  mapDispatchToProps,
)(Output);

export default ConnectedOutput;
