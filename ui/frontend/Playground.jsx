import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import Configuration from './Configuration';
import Header from './Header';
import Editor from './Editor';
import Output from './Output';

function ConfigurationModal() {
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <Configuration  />
      </div>
    </div>
  );
}

class Playground extends React.Component {
  render() {
    const { showConfig, focus } = this.props;

    const config = showConfig ? <ConfigurationModal /> : null;
    const outputFocused = focus ? 'playground-output-focused' : '';

    return (
      <div>
        { config }
        <div className="playground">
          <div className="playground-header">
            <Header />
          </div>
          <div className="playground-editor">
            <Editor />
          </div>
          <div className={`playground-output ${outputFocused}`}>
            <Output />
          </div>
        </div>
      </div>
    );
  }

  componentDidUpdate(prevProps, _prevState) {
    if (this.props.focus !== prevProps.focus) {
      // Inform the ACE editor that its size has changed.
      try {
        window.dispatchEvent(new Event('resize'));
      } catch (ex) {
        // IE 11
        const evt = window.document.createEvent('UIEvents');
        evt.initUIEvent('resize', true, false, window, 0);
        window.dispatchEvent(evt);
      }
    }
  }
}

Playground.propTypes = {
  focus: PropTypes.string,
  showConfig: PropTypes.bool.isRequired,
};

const mapStateToProps = ({ configuration: { shown: showConfig }, output: { meta: { focus } } }) => (
  { showConfig, focus }
);

const ConnectedPlayground = connect(
  mapStateToProps
)(Playground);

export default ConnectedPlayground;
