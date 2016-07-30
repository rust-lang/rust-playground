import React, { PropTypes } from 'react';
import PureComponent from './PureComponent';
import { connect } from 'react-redux';

import {
  changeChannel,
  changeMode,
  performClippy,
  performCompileToAssembly,
  performCompileToLLVM,
  performExecute,
  performFormat,
  performGistSave,
  toggleConfiguration,
} from './actions';

function oneRadio(name, currentValue, possibleValue, change, labelText) {
  const id = `${name}-${possibleValue}`;
  return [
    <input className="header-radio" type="radio" name={name} id={id} key={`${id}-input`}
           checked={ currentValue === possibleValue } onChange={ () => change(possibleValue) } />,
    <label className="header-radio-label" htmlFor={id} key={`${id}-label`}>{labelText}</label>
  ];
}

class Header extends PureComponent {
  render() {
    const {
      execute, compileToAssembly, compileToLLVM,
      format, clippy, gistSave,
      channel, changeChannel, mode, changeMode,
      tests,
      toggleConfiguration
    } = this.props;

    const oneChannel = (value, labelText) =>
            oneRadio("channel", channel, value, changeChannel, labelText);
    const oneMode = (value, labelText) =>
            oneRadio("mode", mode, value, changeMode, labelText);

    const executionLabel = tests ? "Test" : "Run";

    return (
      <div className="header">
        <div className="header-compilation header-set">
          <button className="header-btn header-btn-primary"
                  onClick={ execute }>{ executionLabel }</button>
          <button className="header-btn"
                  onClick={ compileToAssembly }>ASM</button>
          <button className="header-btn"
                  onClick={ compileToLLVM }>LLVM IR</button>
        </div>

        <div className="header-tools header-set">
          <legend className="header-title">Tools</legend>
          <button className="header-btn"
                  onClick={ format }>Format</button>
          <button className="header-btn"
                  onClick={ clippy }>Clippy</button>
        </div>

        <div className="header-sharing header-set">
          <button className="header-btn"
                  onClick={ gistSave }>Gist</button>
        </div>

        <div className="header-mode header-set">
          <legend className="header-title">Mode</legend>
          { oneMode("debug", "Debug") }
          { oneMode("release", "Release") }
        </div>

        <div className="header-channel header-set">
          <legend className="header-title">Channel</legend>
          { oneChannel("stable", "Stable") }
          { oneChannel("beta", "Beta") }
          { oneChannel("nightly", "Nightly") }
        </div>

        <div className="header-set">
          <button className="header-btn"
                  onClick={toggleConfiguration}>Config</button>
        </div>
      </div>
    );
  }
}

Header.propTypes = {
  changeChannel: PropTypes.func.isRequired,
  changeMode: PropTypes.func.isRequired,
  channel: PropTypes.string.isRequired,
  clippy: PropTypes.func.isRequired,
  compileToAssembly: PropTypes.func.isRequired,
  compileToLLVM: PropTypes.func.isRequired,
  execute: PropTypes.func.isRequired,
  format: PropTypes.func.isRequired,
  gistSave: PropTypes.func.isRequired,
  mode: PropTypes.string.isRequired,
  tests: PropTypes.bool.isRequired,
  toggleConfiguration: PropTypes.func.isRequired
};

const mapStateToProps = ({ configuration: { channel, mode, tests } }) => (
  { channel, mode, tests }
);

const mapDispatchToProps = dispatch => ({
  changeChannel: channel => dispatch(changeChannel(channel)),
  changeMode: mode => dispatch(changeMode(mode)),
  clippy: () => dispatch(performClippy()),
  compileToAssembly: () => dispatch(performCompileToAssembly()),
  compileToLLVM: () => dispatch(performCompileToLLVM()),
  execute: () => dispatch(performExecute()),
  format: () => dispatch(performFormat()),
  gistSave: () => dispatch(performGistSave()),
  toggleConfiguration: () => dispatch(toggleConfiguration()),
});

const ConnectedHeader = connect(
  mapStateToProps,
  mapDispatchToProps
)(Header);

export default ConnectedHeader;
