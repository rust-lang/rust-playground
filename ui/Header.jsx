import React, { PropTypes } from 'react';

export default class Header extends React.Component {
  render() {
    const { build, format, channel, changeChannel } = this.props;

    function oneChannel(which, text) {
      return (
        <label>
          <input type="radio" name="channel"
                 checked={ channel === which } onChange={ () => changeChannel(which) } />
          <span>{text}</span>
        </label>
      );
    }

    return (
      <div>
        <button onClick={ build }>Build</button>
        <button onClick={ format }>Format</button>
        { oneChannel("stable", "Stable") }
        { oneChannel("beta", "Beta") }
        { oneChannel("nightly", "Nightly") }
      </div>
    );
  }
};

Header.propTypes = {
  build: PropTypes.func.isRequired,
  format: PropTypes.func.isRequired,
  channel: PropTypes.string.isRequired,
  changeChannel: PropTypes.func.isRequired
};
