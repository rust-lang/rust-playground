import React from 'react';
import { connect } from 'react-redux';

import Configuration from './Configuration';
import Header from './Header';
import Editor from './Editor';
import Output from './Output';
import State from './state';

const ConfigurationModal: React.SFC = () => (
  <div className="modal-backdrop">
    <div className="modal-content">
      <Configuration />
    </div>
  </div>
);

class Playground extends React.Component<Props> {
  render() {
    const { showConfig, focus, splitOrientation } = this.props;

    const config = showConfig ? <ConfigurationModal /> : null;
    const outputFocused = focus ? 'playground-output-focused' : '';
    const splitClass = 'playground-split';
    const orientation = splitClass + '-' + splitOrientation;

    return (
      <div>
        { config }
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

interface Props {
  focus?: string,
  showConfig: boolean,
  splitOrientation: string,
};

const mapStateToProps = ({
    configuration: { shown: showConfig, orientation: splitOrientation },
    output: { meta: { focus } }
}: State) => (
  { showConfig, focus, splitOrientation }
);

export default connect(mapStateToProps, undefined)(Playground);
