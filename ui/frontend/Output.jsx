import React, { PropTypes } from 'react';

export default class Output extends React.Component {
  render() {
    const { output: { meta: { focus } }, changeFocus } = this.props;

    const onePane = (panel, focus, fn) => {
      if (focus === panel) {
        return (
          <div className={`output-${panel}`}>
            { fn() }
          </div>
        );
      } else {
        return null;
      }
    };

    const oneButton = (kind, label) =>
            <button onClick={() => changeFocus(kind)}>{label}</button>;

    return (
      <div className="output">
        <div className="output-tabs">
          { oneButton('execute', 'Execute') }
          { oneButton('clippy', 'Clippy') }
          { oneButton('asm', 'ASM') }
          { oneButton('llvm-ir', 'LLVM IR') }
          { oneButton('gist', 'Gist') }
          <button onClick={ () => changeFocus(null) }>Close</button>
        </div>
        <div className="output-body">
          { onePane('execute', focus, () => this.renderExecute()) }
          { onePane('clippy', focus, () => this.renderClippy()) }
          { onePane('asm', focus, () => this.renderAssembly()) }
          { onePane('llvm-ir', focus, () => this.renderLlvmIr()) }
          { onePane('gist', focus, () => this.renderGist()) }
        </div>
      </div>
    );
  }

  renderExecute() {
    const { stdout, stderr, error } = this.props.output.execute;

    return (
      <pre>
        <code className="output-error">{error}</code>
        <code className="output-stderr">{stderr}</code>
        <code className="output-stdout">{stdout}</code>
      </pre>
    );
  }

  renderClippy() {
    const { stdout, stderr, error } = this.props.output.clippy;

    return (
      <pre>
        <code className="output-error">{error}</code>
        <code className="output-stderr">{stderr}</code>
        <code className="output-stdout">{stdout}</code>
      </pre>
    );
  }

  renderLlvmIr() {
    const { code, stdout, stderr, error } = this.props.output.llvmIr;

    return (
      <pre>
        <code className="output-error">{error}</code>
        <code className="output-stderr">{stderr}</code>
        <code className="output-stdout">{stdout}</code>
        <code className="output-code">{code}</code>
      </pre>
    );
  }

  renderAssembly() {
    const { code, stdout, stderr, error } = this.props.output.assembly;

    return (
      <pre>
        <code className="output-error">{error}</code>
        <code className="output-stderr">{stderr}</code>
        <code className="output-stdout">{stdout}</code>
        <code className="output-code">{code}</code>
      </pre>
    );
  }

  renderGist() {
    const { id, url } = this.props.output.gist;

    return (
      <div>
        <p>
          <a href={`/?gist=${id}`}>Permalink to the playground</a>
        </p>
        <p>
          <a href={url}>Direct link to the gist</a>
        </p>
      </div>
    );
  }
};

Output.propTypes = {
  meta: PropTypes.shape({
    requestsInProgress: PropTypes.number.isRequired,
    focus: PropTypes.string
  }),

  clippy: PropTypes.shape({
    stdout: PropTypes.string,
    stderr: PropTypes.string,
    error: PropTypes.string
  }),

  llvmIr: PropTypes.shape({
    code: PropTypes.string,
    stdout: PropTypes.string,
    stderr: PropTypes.string,
    error: PropTypes.string
  }),

  assembly: PropTypes.shape({
    code: PropTypes.string,
    stdout: PropTypes.string,
    stderr: PropTypes.string,
    error: PropTypes.string
  }),

  execute: PropTypes.shape({
    stdout: PropTypes.string,
    stderr: PropTypes.string,
    error: PropTypes.string
  }),

  gist: PropTypes.shape({
    id: PropTypes.string,
    url: PropTypes.string
  }),

  changeFocus: PropTypes.func.isRequired
};
