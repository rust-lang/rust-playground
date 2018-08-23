import React from 'react';
import { connect } from 'react-redux';

import Configuration from './Configuration';
import Editor from './Editor';
import Header from './Header';
import Notifications from './Notifications';
import Output from './Output';
import { anyNotificationsToShowSelector } from './selectors';
import State from './state';
import { Focus, Orientation } from './types';

const ConfigurationModal: React.SFC = () => (
  <div className="modal-backdrop">
    <div className="modal-content">
      <Configuration />
    </div>
  </div>
);

const Playground: React.SFC<Props> = ({ showConfig, showNotifications, focus, splitOrientation }) => {
  const config = showConfig ? <ConfigurationModal /> : null;
  const outputFocused = focus ? 'playground-output-focused' : '';
  const splitClass = 'playground-split';
  const orientation = splitClass + '-' + splitOrientation;

  return (
    <div>
      {config}
      <div className="playground">
        <div className="playground-header">
          <Header />
        </div>
        <div className={`${splitClass} ${orientation}`}>
          <div className="playground-editor">
            <Editor />
          </div>
          <div className={`playground-output ${outputFocused}`}>
            <Output />
          </div>
        </div>
      </div>
      {showNotifications && <Notifications />}
    </div>
  );
};

interface Props {
  focus?: Focus;
  showConfig: boolean;
  showNotifications: boolean;
  splitOrientation: Orientation;
}

const mapStateToProps = (state: State) => ({
  showConfig: state.configuration.shown,
  focus: state.output.meta.focus,
  splitOrientation: state.configuration.orientation,
  showNotifications: anyNotificationsToShowSelector(state),
});

export default connect(mapStateToProps)(Playground);
