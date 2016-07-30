import React, { PropTypes } from 'react';
import PureComponent from './PureComponent';
import { connect } from 'react-redux';
import { PrismCode } from "react-prism";

import { changeFocus } from './actions';

import Loader from './Loader';

const hasProperties = (obj) => Object.values(obj).some(val => val);

function Tab({ kind, focus, label, onClick, tabProps }) {
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

Tab.propTypes = {
  kind: PropTypes.string.isRequired,
  focus: PropTypes.string,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  tabProps: PropTypes.object.isRequired,
};

function Header({ label }) {
  return <span className="output-header">{ label }</span>;
}

Header.propTypes = {
  label: PropTypes.string.isRequired,
};

function Section({ kind, label, children }) {
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

Section.propTypes = {
  kind: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
};

function MyLoader() {
  return (
    <div>
      <Header label="Progress" />
      <Loader />
    </div>
  );
}

class HighlightErrors extends PureComponent {
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

function SimplePane({ focus, kind, requestsInProgress, stdout, stderr, error, children }) {
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

SimplePane.propTypes = {
  focus: PropTypes.string.isRequired,
  kind: PropTypes.string.isRequired,
  requestsInProgress: PropTypes.number.isRequired,
  stdout: PropTypes.string,
  stderr: PropTypes.string,
  error: PropTypes.string,
  children: PropTypes.node,
};

function PaneWithCode(props) {
  const { code, ...rest } = props;

  return (
    <SimplePane {...rest} >
      <Section kind='code' label='Result'>{code}</Section>
    </SimplePane>
  );
}

PaneWithCode.propTypes = {
  code: PropTypes.string,
};

function Gist({ focus, requestsInProgress, id, url }) {
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

Gist.propTypes = {
  focus: PropTypes.string.isRequired,
  requestsInProgress: PropTypes.number.isRequired,
  id: PropTypes.string,
  url: PropTypes.string,
};

class Output extends PureComponent {
  focusClose = () => this.props.changeFocus(null);
  focusExecute = () => this.props.changeFocus('execute');
  focusClippy = () => this.props.changeFocus('clippy');
  focusAssembly = () => this.props.changeFocus('asm');
  focusLlvmIr = () => this.props.changeFocus('llvm-ir');
  focusGist = () => this.props.changeFocus('gist');

  render() {
    const {
      meta: { focus }, execute, clippy, assembly, llvmIr, gist,
    } = this.props;

    const somethingToShow = [execute, clippy, assembly, llvmIr, gist].some(hasProperties);

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
               onClick={this.focusExecute}
               tabProps={execute} />
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
          <Tab kind="gist" focus={focus}
               label="Gist"
               onClick={this.focusGist}
               tabProps={gist} />
          { close }
        </div>
        { body }
      </div>
    );
  }
}

const simpleProps = PropTypes.shape({
  stdout: PropTypes.string,
  stderr: PropTypes.string,
  error: PropTypes.string,
});

const withCodeProps = PropTypes.shape({
  code: PropTypes.string,
  stdout: PropTypes.string,
  stderr: PropTypes.string,
  error: PropTypes.string,
});

Output.propTypes = {
  meta: PropTypes.shape({
    focus: PropTypes.string,
  }),

  execute: simpleProps,
  clippy: simpleProps,
  llvmIr: withCodeProps,
  assembly: withCodeProps,

  gist: PropTypes.shape({
    id: PropTypes.string,
    url: PropTypes.string,
  }),

  changeFocus: PropTypes.func.isRequired,
};

const mapStateToProps = ({ output }) => output;

const mapDispatchToProps = dispatch => ({
  changeFocus: x => dispatch(changeFocus(x)),
});

const ConnectedOutput = connect(
  mapStateToProps,
  mapDispatchToProps
)(Output);

export default ConnectedOutput;
