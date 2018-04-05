import React from 'react';
import { connect } from 'react-redux';

import Configuration from './Configuration';
import Editor from './Editor';
import Header from './Header';
import Output from './Output';
import { Focus } from './reducers/output/meta';
import State from './state';
import { Orientation, PageMode } from './types';

const ConfigurationModal: React.SFC = () => (
  <div className="modal-backdrop">
    <div className="modal-content">
      <Configuration />
    </div>
  </div>
);

const Playground: React.SFC<Props> = ({ showConfig, focus, splitOrientation, pageMode }) => {
  const config = showConfig ? <ConfigurationModal /> : null;
  const outputFocused = focus ? 'playground-output-focused' : '';
  const splitClass = 'playground-split';
  const orientation = splitClass + '-' + splitOrientation;

  return (
    <div className={`playground-mode-${pageMode}`}>
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
    </div>
  );
};

interface Props {
  focus?: Focus;
  pageMode: PageMode;
  showConfig: boolean;
  splitOrientation: Orientation;
}

const mapStateToProps = (state: State) => ({
  pageMode: state.configuration.pageMode,
  showConfig: state.configuration.shown,
  focus: state.output.meta.focus,
  splitOrientation: state.configuration.orientation,
});

export default connect(mapStateToProps)(Playground);
