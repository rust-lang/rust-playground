import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import { PrismCode } from "react-prism";
import "prismjs/components/prism-rust.min";

import { showExample } from './actions';

const Example = ({ code, showExample }) => (
  <pre className="help__example">
    <button className="help__load_example" onClick={() => showExample(code)}>
      Load in playground
    </button>
    <PrismCode className="language-rust">
      {code}
    </PrismCode>
  </pre>
);

Example.propTypes = {
  code: PropTypes.string.isRequired,
  showExample: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => bindActionCreators({
  showExample,
}, dispatch);

export default connect(null, mapDispatchToProps)(Example);
