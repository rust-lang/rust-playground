import React, { PropTypes } from 'react';
import { connect } from 'react-redux';

import Configuration from './Configuration';
import Header from './Header';
import Editor from './Editor';
import Output from './Output';

import {
  invertHemisphere,
  toggleConfiguration,
} from './actions';

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
    const { hemisphere, hemisphereEnabled, showConfig, focus, toggleConfiguration, invertHemisphere } = this.props;

    const config = showConfig ? <ConfigurationModal /> : null;
    const outputFocused = focus ? 'playground-output-focused' : '';

    const SaveMeNorthern = () => (
      <span>
        We have added a feature to help Rust programmers gain an intuition
        about compiler errors. Unfortunately, there are some
        issues with our implementation and we may have incorrectly guessed your
        location. If the compiler output appears upside-down, please
        { ' ' }
        <a href="#" onClick={invertHemisphere}>adjust your location</a>.
      </span>
    );

    const SaveMeSouthern = () => (
      <span>
        If you are tired of these shenanigans, please
        { ' ' }
        <a href="#" onClick={toggleConfiguration}>adjust your location</a>
        { ' ' }
        appropriately.
      </span>
    );

    const SaveMe = hemisphere === 'northern' ? SaveMeNorthern : SaveMeSouthern;

    const notice = focus && hemisphereEnabled ? (
      <div className="playground-hemisphere-notice">
 <SaveMe />
      </div>
    ) : null;

    return (
      <div>
        { config }
        <div className={`playground ${hemisphereEnabled ? `playground--${hemisphere}` : ''}`}>
          <div className="playground-header">
            <Header />
          </div>
          <div className="playground-editor">
            <Editor />
          </div>
          { notice }
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
  hemisphere: PropTypes.string.isRequired,
  hemisphereEnabled: PropTypes.bool.isRequired,
  focus: PropTypes.string,
  showConfig: PropTypes.bool.isRequired,
  toggleConfiguration: PropTypes.func.isRequired,
  invertHemisphere: PropTypes.func.isRequired,
};

const mapStateToProps = ({ configuration: { shown: showConfig, hemisphere, hemisphereEnabled }, output: { meta: { focus } } }) => (
  { hemisphere, hemisphereEnabled, showConfig, focus }
);

const mapDispatchToProps = dispatch => ({
  invertHemisphere: () => dispatch(invertHemisphere()),
  toggleConfiguration: () => dispatch(toggleConfiguration()),
});

const ConnectedPlayground = connect(
  mapStateToProps, mapDispatchToProps
)(Playground);

export default ConnectedPlayground;
