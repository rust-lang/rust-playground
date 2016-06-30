import React, { PropTypes } from 'react';

function oneRadio(name, currentValue, possibleValue, change, labelText) {
  const id = `${name}-${possibleValue}`;
  return [
    <input className="header-radio" type="radio" name={name} id={id} key={`${id}-input`}
           checked={ currentValue === possibleValue } onChange={ () => change(possibleValue) } />,
    <label className="header-radio-label" htmlFor={id} key={`${id}-label`}>{labelText}</label>
  ];
}

export default class Header extends React.Component {
  render() {
    const {
      execute, compileToAssembly, compileToLLVM,
      format, clippy, saveToGist,
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
          <button className="header-btn"
                  onClick={ format }>Format</button>
        </div>

        <div className="header-sharing header-set">
          <button className="header-btn"
                  onClick={ saveToGist }>Gist</button>
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
};

Header.propTypes = {
  execute: PropTypes.func.isRequired,
  compileToAssembly: PropTypes.func.isRequired,
  compileToLLVM: PropTypes.func.isRequired,
  format: PropTypes.func.isRequired,
  clippy: PropTypes.func.isRequired,
  saveToGist: PropTypes.func.isRequired,
  channel: PropTypes.string.isRequired,
  changeChannel: PropTypes.func.isRequired,
  mode: PropTypes.string.isRequired,
  changeMode: PropTypes.func.isRequired,
  tests: PropTypes.bool.isRequired,
  toggleConfiguration: PropTypes.func.isRequired
};
