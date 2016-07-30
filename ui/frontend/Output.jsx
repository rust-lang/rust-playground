import React, { PropTypes } from 'react';
import PureComponent from './PureComponent';

import Loader from './Loader';

const hasProperties = (obj) => Object.values(obj).some(val => val);

function Tab(props) {
  const { kind, focus, label, onClick, tabProps } = props;

  if (hasProperties(tabProps)) {
    const selected = focus === kind ? "output-tab-selected" : "";
    return (
      <button className={`output-tab ${selected}`}
              onClick={props.onClick}>
        {label}
      </button>
    );
  } else {
    return null;
  }
}

function Header(props) {
  return <span className="output-header">{ props.label }</span>;
}

function Section(props) {
  const { kind, label, content } = props;

  if (content) {
    return (
      <div className={`output-${kind}`}>
        <Header label={label} />
        <pre><code>{content}</code></pre>
      </div>
    );
  } else {
    return null;
  }
}

function MyLoader(props) {
  return (
    <div>
      <Header label="Progress" />
      <Loader />
    </div>
  );
}

import { PrismCode } from "react-prism";

export default class HighlightErrors extends PureComponent {
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

function SimplePane(props) {
  const { focus, kind, requestsInProgress, stdout, stderr, error, children } = props;

  if (focus === kind) {
    const loader = (requestsInProgress > 0) ? <MyLoader /> : null;
    return (
      <div className={`output-${kind}`}>
        { loader }
        <Section kind='error' label='Errors' content={error} />
        <HighlightErrors label="Standard Error">{stderr}</HighlightErrors>
        <Section kind='stdout' label='Standard Output' content={stdout} />
        { children }
      </div>
    );
  } else {
    return null;
  }
}

function PaneWithCode(props) {
  const { code, ...rest } = props;

  return (
    <SimplePane {...rest} >
      <Section kind='code' label='Result' content={code} />
    </SimplePane>
  );
}

function Gist(props) {
  const { focus, requestsInProgress, id, url } = props;

  if (focus === 'gist') {
    const loader = (requestsInProgress > 0) ? <MyLoader /> : null;
    const permalink = id ? <p><a href={`/?gist=${id}`}>Permalink to the playground</a></p> : null;
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
}

export default class Output extends PureComponent {
  focusClose = () => this.props.changeFocus(null);
  focusExecute = () => this.props.changeFocus('execute');
  focusClippy = () => this.props.changeFocus('clippy');
  focusAssembly = () => this.props.changeFocus('asm');
  focusLlvmIr = () => this.props.changeFocus('llvm-ir');
  focusGist = () => this.props.changeFocus('gist');

  render() {
    const {
      focusClose, focusExecute, focusClippy, focusAssembly, focusLlvmIr, focusGist,
      output: { meta: { focus }, execute, clippy, assembly, llvmIr, gist },
      changeFocus
    } = this.props;

    const somethingToShow = [execute, clippy, assembly, llvmIr, gist].some(hasProperties);

    if (!somethingToShow) {
      return null;
    }

    var close = null, body = null;
    if (focus) {
      close = (
        <button className="output-tab output-tab-close"
                onClick={focusClose}>Close</button>
      );

      body = (
        <div className="output-body">
          <SimplePane {...execute} kind="execute" focus={focus} />
          <SimplePane {...clippy} kind="clippy" focus={focus} />
          <PaneWithCode {...assembly} kind="asm" focus={focus} />
          <PaneWithCode {...llvmIr} kind="llvm-ir" focus={focus} />
          <Gist {...gist} focus={focus} />
        </div>
      );
    }

    return (
      <div className="output">
        <div className="output-tabs">
          <Tab kind="execute" focus={focus}
               label="Execution"
               onClick={focusExecute}
               tabProps={execute} />
          <Tab kind="clippy"
               focus={focus}
               label="Clippy"
               onClick={focusClippy}
               tabProps={clippy} />
          <Tab kind ="asm" focus={focus}
               label="ASM"
               onClick={focusAssembly}
               tabProps={assembly} />
          <Tab kind="llvm-ir" focus={focus}
               label="LLVM IR"
               onClick={focusLlvmIr}
               tabProps={llvmIr} />
          <Tab kind="gist" focus={focus}
               label="Gist"
               onClick={focusGist}
               tabProps={gist} />
          { close }
        </div>
        { body }
      </div>
    );
  }
};

const simpleProps = PropTypes.shape({
  stdout: PropTypes.string,
  stderr: PropTypes.string,
  error: PropTypes.string
});

const withCodeProps = PropTypes.shape({
  code: PropTypes.string,
  stdout: PropTypes.string,
  stderr: PropTypes.string,
  error: PropTypes.string
});

Output.propTypes = {
  meta: PropTypes.shape({
    requestsInProgress: PropTypes.number.isRequired,
    focus: PropTypes.string
  }),

  execute: simpleProps,
  clippy: simpleProps,
  llvmIr: withCodeProps,
  assembly: withCodeProps,

  gist: PropTypes.shape({
    id: PropTypes.string,
    url: PropTypes.string
  }),

  changeFocus: PropTypes.func.isRequired
};
