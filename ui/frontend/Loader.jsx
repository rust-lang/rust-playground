import React, { PropTypes } from 'react';

export default class Loader extends React.Component {
  render() {

    return (
      <div className="loader">
        <span className="loader-dot">⬤</span>
        <span className="loader-dot">⬤</span>
        <span className="loader-dot">⬤</span>
      </div>
    );
  }
};

Loader.propTypes = {};
