import React, { PropTypes } from 'react';

function oneRadio(name, currentValue, possibleValue, change, labelText) {
  return (
    <label>
      <input type="radio" name={name}
             checked={ currentValue === possibleValue } onChange={ () => change(possibleValue) } />
        <span>{labelText}</span>
    </label>
  );
}

export default class Header extends React.Component {
  render() {
    const { build, format, channel, changeChannel, mode, changeMode, tests } = this.props;

    const oneChannel = (value, labelText) => oneRadio("channel", channel, value, changeChannel, labelText);
    const oneMode = (value, labelText) => oneRadio("mode", mode, value, changeMode, labelText);

    const executionLabel = tests ? "Test" : "Build";

    return (
      <div>
        <button onClick={ build }>{ executionLabel }</button>
        <button onClick={ format }>Format</button>
        { oneChannel("stable", "Stable") }
        { oneChannel("beta", "Beta") }
        { oneChannel("nightly", "Nightly") }
        { oneMode("debug", "Debug") }
        { oneMode("release", "Release") }
      </div>
    );
  }
};

Header.propTypes = {
  build: PropTypes.func.isRequired,
  format: PropTypes.func.isRequired,
  channel: PropTypes.string.isRequired,
  changeChannel: PropTypes.func.isRequired,
  mode: PropTypes.string.isRequired,
  changeMode: PropTypes.func.isRequired,
  tests: PropTypes.bool.isRequired
};
