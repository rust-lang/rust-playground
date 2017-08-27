import React from 'react';
import { connect } from 'react-redux';
import Link from './uss-router/Link';

import {
  changeChannel,
  changeMode,
  performClippy,
  performCompileToAssembly,
  performCompileToLLVM,
  performCompileToMir,
  performExecute,
  performFormat,
  performGistSave,
  toggleConfiguration,
  navigateToHelp,
} from './actions';
import { getCrateType, runAsTest } from './selectors';
import State from './state';
import { Channel } from './types';

function oneRadio<T>(name: string, currentValue: T, possibleValue: T, change: (T) => any, labelText: string) {
  const id = `${name}-${possibleValue}`;
  return [
    <input className="header-set__radio" type="radio" name={name} id={id} key={`${id}-input`}
           checked={ currentValue === possibleValue } onChange={ () => change(possibleValue) } />,
    <label className="header-set__radio-label" htmlFor={id} key={`${id}-label`}>{labelText}</label>,
  ];
}

const executionLabel = (crateType, tests) => {
  if (tests) { return "Test"; }
  if (crateType === 'bin') { return "Run"; }
  return "Build";
};

class Header extends React.PureComponent<HeaderProps> {
  render() {
    const {
      execute, compileToAssembly, compileToLLVM, compileToMir,
      format, clippy, gistSave,
      channel, changeChannel, mode, changeMode,
      crateType, tests,
      toggleConfiguration, navigateToHelp,
    } = this.props;

    const oneChannel = (value: Channel, labelText) =>
            oneRadio("channel", channel, value, changeChannel, labelText);
    const oneMode = (value, labelText) =>
            oneRadio("mode", mode, value, changeMode, labelText);

    const primaryLabel = executionLabel(crateType, tests);

    return (
      <div className="header">
        <div className="header-compilation header-set">
          <button className="header-set__btn header-set__btn--primary"
                  onClick={ execute }>{ primaryLabel }</button>
          <div className="header-set__buttons header-set__buttons--primary">
            <button className="header-set__btn"
                    onClick={ compileToAssembly }>ASM</button>
            <button className="header-set__btn"
                    onClick={ compileToLLVM }>LLVM IR</button>
            <button className="header-set__btn"
                    onClick={ compileToMir }>MIR</button>
          </div>
        </div>

        <div className="header-tools header-set">
          <legend className="header-set__title">Tools</legend>
          <div className="header-set__buttons">
            <button className="header-set__btn"
                    onClick={ format }>Format</button>
            <button className="header-set__btn"
                    onClick={ clippy }>Clippy</button>
          </div>
        </div>

        <div className="header-sharing header-set">
          <div className="header-set__buttons">
            <button className="header-set__btn"
                    onClick={ gistSave }>Share</button>
          </div>
        </div>

        <div className="header-mode header-set">
          <legend className="header-set__title">Mode</legend>
          <div className="header-set__buttons header-set__buttons--radio">
            { oneMode("debug", "Debug") }
            { oneMode("release", "Release") }
          </div>
        </div>

        <div className="header-channel header-set">
          <legend className="header-set__title">Channel</legend>
          <div className="header-set__buttons header-set__buttons--radio">
            { oneChannel(Channel.Stable, "Stable") }
            { oneChannel(Channel.Beta, "Beta") }
            { oneChannel(Channel.Nightly, "Nightly") }
          </div>
        </div>

        <div className="header-set">
          <div className="header-set__buttons">
            <button className="header-set__btn"
                    onClick={toggleConfiguration}>Config</button>
          </div>
        </div>

        <div className="header-set">
          <div className="header-set__buttons">
            <Link className="header-set__btn" action={navigateToHelp}>?</Link>
          </div>
        </div>
      </div>
    );
  }
}

interface HeaderProps {
  changeChannel: (Channel) => any,
  changeMode: (string) => any,
  channel: Channel,
  clippy: () => any,
  compileToAssembly: () => any,
  compileToLLVM: () => any,
  compileToMir: () => any,
  execute: () => any,
  format: () => any,
  gistSave: () => any,
  mode: string,
  crateType: string,
  tests: boolean,
  toggleConfiguration: () => any,
  navigateToHelp: () => any,
};

const mapStateToProps = (state: State) => {
  const { configuration: { channel, mode } } = state;

  return {
    channel,
    mode,
    crateType: getCrateType(state),
    tests: runAsTest(state),
    navigateToHelp,
  };
};

const mapDispatchToProps = ({
  changeChannel,
  changeMode,
  clippy: performClippy,
  compileToAssembly: performCompileToAssembly,
  compileToLLVM: performCompileToLLVM,
  compileToMir: performCompileToMir,
  execute: performExecute,
  format: performFormat,
  gistSave: performGistSave,
  toggleConfiguration,
});

const ConnectedHeader = connect(
  mapStateToProps,
  mapDispatchToProps
)(Header);

export default ConnectedHeader;
