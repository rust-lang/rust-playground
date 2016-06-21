import React, { PropTypes } from 'react';

export default class Editor extends React.Component {
  render() {
    const { code, onEditCode } = this.props;

    return (
      <textarea value={ code } onChange={ (e) => onEditCode(e.target.value) } />
    );
  }
};

Editor.propTypes = {
  onEditCode: PropTypes.func.isRequired,
  code: PropTypes.string.isRequired
};
