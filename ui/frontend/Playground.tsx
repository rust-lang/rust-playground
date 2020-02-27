import React from 'react';
import { useSelector } from 'react-redux';

import Editor from './Editor';
import Header from './Header';
import Notifications from './Notifications';
import Output from './Output';
import RustfmtTomlModal from './RustfmtTomlModal';
import * as selectors from './selectors';
import State from './state';

const Playground: React.SFC = () => {
  const showNotifications = useSelector(selectors.anyNotificationsToShowSelector);
  const showRustfmtTomlModal = useSelector((state: State) => state.rustfmt.show);
  const focus = useSelector((state: State) => state.output.meta.focus);
  const splitOrientation = useSelector((state: State) => state.configuration.orientation);

  const outputFocused = focus ? 'playground-output-focused' : '';
  const splitClass = 'playground-split';
  const orientation = splitClass + '-' + splitOrientation;

  const rustfmtModal = showRustfmtTomlModal
    ? <RustfmtTomlModal />
    : null

  return (
    <div>
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
      {rustfmtModal}
    </div>
  );
};

export default Playground;
