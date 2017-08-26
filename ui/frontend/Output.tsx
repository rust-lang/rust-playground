import React from 'react';
import { connect } from 'react-redux';
import { PrismCode } from "react-prism";

import { changeFocus } from './actions';

import Loader from './Loader';

const hasProperties = obj => Object.values(obj).some(val => val);

const Tab: React.SFC<TabProps> = ({ kind, focus, label, onClick, tabProps }) => {
  if (hasProperties(tabProps)) {
    const selected = focus === kind ? "output-tab-selected" : "";
    return (
      <button className={`output-tab ${selected}`}
              onClick={onClick}>
        {label}
      </button>
    );
  } else {
    return null;
  }
}

interface TabProps {
  kind: string,
  focus?: string,
  label: string,
  onClick: () => any,
  tabProps: object,
};

const Header: React.SFC<HeaderProps> = ({ label }) => (
  <span className="output-header">{ label }</span>
);

interface HeaderProps {
  label: string,
};

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
}

interface SectionProps {
  kind: string,
  label: string,
};

const MyLoader: React.SFC = () => (
  <div>
      <Header label="Progress" />
      <Loader />
  </div>
);

class HighlightErrors extends React.PureComponent<HighlightErrorsProps> {
  render() {
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
  label: string,
};

const SimplePane: React.SFC<SimplePaneProps> = ({
  focus, kind, requestsInProgress, stdout, stderr, error, children
}) => {
  if (focus === kind) {
    const loader = (requestsInProgress > 0) ? <MyLoader /> : null;
    return (
      <div className={`output-${kind}`}>
        { loader }
        <Section kind='error' label='Errors'>{error}</Section>
        <HighlightErrors label="Standard Error">{stderr}</HighlightErrors>
        <Section kind='stdout' label='Standard Output'>{stdout}</Section>
        { children }
      </div>
    );
  } else {
    return null;
  }
}

interface SimplePaneProps extends SimpleProps {
  focus: string,
  kind: string,
};

const PaneWithCode: React.SFC<PaneWithCodeProps> = ({ code, ...rest }) => (
  <SimplePane {...rest}>
    <Section kind='code' label='Result'>{code}</Section>
  </SimplePane>
);

interface PaneWithCodeProps extends SimplePaneProps {
  code?: string,
};

const Format: React.SFC<FormatProps> = ({ focus, requestsInProgress }) => {
  if (focus === 'format') {
    const loader = (requestsInProgress > 0) ? <MyLoader /> : null;

    return (
      <div className="output-format">
        { loader }
      </div>
    );
  } else {
    return null;
  }
};

interface FormatProps {
  focus: string,
  requestsInProgress: number,
};

const Gist: React.SFC<GistProps> = ({ focus, requestsInProgress, id, url, channel }) => {
  if (focus === 'gist') {
    const loader = (requestsInProgress > 0) ? <MyLoader /> : null;
    const permalink = id ? <p><a href={`/?gist=${id}&version=${channel}`}>Permalink to the playground</a></p> : null;
    const directLink = url ? (<p><a href={url}>Direct link to the gist</a></p>) : null;

    return (
      <div className="output-gist">
        { loader }
        { permalink }
        { directLink }
      </div>
    );
  } else {
    return null;
  }
};

interface GistProps {
  focus: string,
  requestsInProgress: number,
  id?: string,
  url?: string,
  channel?: string,
};

class Output extends React.PureComponent<OutputProps> {
  focusClose = () => this.props.changeFocus(null);
  focusExecute = () => this.props.changeFocus('execute');
  focusFormat = () => this.props.changeFocus('format');
  focusClippy = () => this.props.changeFocus('clippy');
  focusAssembly = () => this.props.changeFocus('asm');
  focusLlvmIr = () => this.props.changeFocus('llvm-ir');
  focusMir = () => this.props.changeFocus('mir');
  focusGist = () => this.props.changeFocus('gist');

  render() {
    const {
      meta: { focus }, execute, format, clippy, assembly, llvmIr, mir, gist,
    } = this.props;

    const somethingToShow = [execute, format, clippy, assembly, llvmIr, mir, gist].some(hasProperties);

    if (!somethingToShow) {
      return null;
    }

    let close = null, body = null;
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
          <Gist {...gist} focus={focus} />
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
          <Tab kind ="asm" focus={focus}
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
          <Tab kind="gist" focus={focus}
               label="Share"
               onClick={this.focusGist}
               tabProps={gist} />
          { close }
        </div>
        { body }
      </div>
    );
  }
}

interface SimpleProps {
  requestsInProgress: number,
  stdout?: string,
  stderr?: string,
  error?: string,
};

interface WithCodeProps extends SimpleProps {
  code: string,
};

interface OutputProps {
  meta: {
    focus: string,
  },

  execute: SimpleProps,
  format: {
    requestsInProgress: number,
  },
  clippy: SimpleProps,
  assembly: WithCodeProps,
  llvmIr: WithCodeProps,
  mir: WithCodeProps,

  gist: {
    requestsInProgress: number,
    id: string,
    url: string,
    channel: string,
  },

  changeFocus: (string?) => any,
};

const mapStateToProps = ({ output }) => output;

const mapDispatchToProps = ({
  changeFocus,
});

const ConnectedOutput = connect(
  mapStateToProps,
  mapDispatchToProps
)(Output);

export default ConnectedOutput;
