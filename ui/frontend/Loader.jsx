import React, { PropTypes } from 'react';
import PureComponent from './PureComponent';

export default class Loader extends PureComponent {
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
