import React, { PropTypes } from 'react';
import { connect } from 'react-redux';

import { changeFocus } from './actions';

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
    const {
      showConfig, focus,
      output, changeFocus
    } = this.props;

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
            <Output output={output} changeFocus={changeFocus} />
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
  showConfig: PropTypes.bool.isRequired,
};

const mapStateToProps = ({ configuration: { shown: showConfig }, output }) => (
  { showConfig, focus: output.meta.focus, output }
);

const mapDispatchToProps = (dispatch) => ({
  changeFocus: x => dispatch(changeFocus(x)),
});

const ConnectedPlayground = connect(
  mapStateToProps,
  mapDispatchToProps
)(Playground);

export default ConnectedPlayground;
