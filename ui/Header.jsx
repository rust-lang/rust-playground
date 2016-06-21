import React, { PropTypes } from 'react';

export default class Header extends React.Component {
  render() {
    const { onBuildClick } = this.props;

    return (
      <button onClick={ onBuildClick }>Build</button>
    );
  }
};

Header.propTypes = {
  onBuildClick: PropTypes.func.isRequired
};
