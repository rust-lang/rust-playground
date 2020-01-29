import React from 'react';

type TomlEditorProps = {
  toml: string;
  onEditCode: (_: string) => any;
}

class TomlEditor extends React.PureComponent<TomlEditorProps> {
  private _editor: HTMLTextAreaElement;

  private onChange = e => this.props.onEditCode(e.target.value);
  private trackEditor = component => this._editor = component;

  public render() {
    return (
      <textarea
        ref={this.trackEditor}
        className="toml-input-area"
        name="toml-input-area"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={this.props.toml}
        onChange={this.onChange} />
    );
  }
}

export default TomlEditor;