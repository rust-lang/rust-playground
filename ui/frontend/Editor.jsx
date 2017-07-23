import React from 'react';
import PropTypes from 'prop-types';
import PureComponent from './PureComponent';
import { connect } from 'react-redux';

import AdvancedEditor from './AdvancedEditor';
import { editCode, performExecute } from './actions';

class SimpleEditor extends PureComponent {
  onChange = e => this.props.onEditCode(e.target.value);
  trackEditor = component => this._editor = component;
  onKeyDown = e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      this.props.execute();
    }
  }

  render() {
    return (
      <textarea
         ref={ this.trackEditor }
         className="editor-simple"
         name="editor-simple"
         value={ this.props.code }
         onChange={ this.onChange }
         onKeyDown= { this.onKeyDown } />
    );
  }

  componentDidUpdate(prevProps, _prevState) {
    this.gotoPosition(prevProps.position, this.props.position);
  }

  gotoPosition(oldPosition, newPosition) {
    const editor = this._editor;

    if (!newPosition || !editor) { return; }
    if (newPosition === oldPosition) { return; }

    // Subtract one as this logix is zero-based and the lines are one-based
    const line = newPosition.line - 1;
    const { code } = this.props;

    const lines = code.split('\n');

    const precedingLines = lines.slice(0, line);
    const highlightedLine = lines[line];

    // Add one to account for the newline we split on and removed
    const precedingBytes = precedingLines.map(l => l.length + 1).reduce((a, b) => a + b);
    const highlightedBytes = highlightedLine.length;

    editor.setSelectionRange(precedingBytes, precedingBytes + highlightedBytes);
  }
}

SimpleEditor.propTypes = {
  code: PropTypes.string.isRequired,
  execute: PropTypes.func.isRequired,
  onEditCode: PropTypes.func.isRequired,
  position: PropTypes.shape({
    line: PropTypes.number.isRequired,
    column: PropTypes.number.isRequired,
  }).isRequired,
};

class Editor extends PureComponent {
  render() {
    const { editor, execute, code, crates, position, onEditCode } = this.props;
    const SelectedEditor = editor === "simple" ? SimpleEditor : AdvancedEditor;

    return (
      <div className="editor">
        <SelectedEditor code={code}
                        position={position}
                        crates={crates}
                        onEditCode={onEditCode}
                        execute={execute} />
      </div>
    );
  }
}

Editor.propTypes = {
  code: PropTypes.string.isRequired,
  editor: PropTypes.string.isRequired,
  execute: PropTypes.func.isRequired,
  onEditCode: PropTypes.func.isRequired,
  position: PropTypes.shape({
    line: PropTypes.number.isRequired,
    column: PropTypes.number.isRequired,
  }).isRequired,
  crates: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    version: PropTypes.string.isRequired,
  })).isRequired,
};

const mapStateToProps = ({ code, configuration: { editor }, position, crates }) => (
  { code, editor, position, crates }
);

const mapDispatchToProps = ({
  execute: performExecute,
  onEditCode: editCode,
});

const ConnectedEditor = connect(
  mapStateToProps,
  mapDispatchToProps
)(Editor);

export default ConnectedEditor;
