import 'ace-builds';

declare module 'ace-builds' {
  export namespace Ace {
    // Allows accessing current commands by name:
    //
    // const gotoCommand = editor.commands.byName.gotoline;
    interface CommandMap {
      [name: string]: Ace.Command;
    }

    export interface CommandManager {
      byName: CommandMap;
    }

    // Allows defining a event handler inline and then removing it
    // later. This is beneficial for type inference purposes:
    //
    // const listener = editor.on<true>('change', console.log);
    // editor.off('change', listener);
    //
    // WARNING: the generic (`<T>`) is purely to allow this overload
    // to be more specific than the current Ace definition; it should
    // not be merged!
    type EditorOnChange = (delta: Delta) => void;

    export interface Editor {
      on<T>(name: 'change', callback: EditorOnChange): EditorOnChange;
    }

    // Allows setting the editor's completion engines:
    //
    // editor.completers = [buildCrateAutocompleter(autocompleteOnUse, crates)];
    type CompleterCallback = (_, completions: Completion[]) => void;

    interface Completer {
      getCompletions(editor: Editor, session: EditSession, position: Point, prefix, callback: CompleterCallback): void;
    }

    export interface Editor {
      completers: Completer[];
    }

    // Allows using the `afterExec` event:
    //
    // editor.commands.on('afterExec', console.log);
    //
    // QUESTION: Should this return the callback object, as above?
    interface CommandEvent {
      editor: Editor;
      command: Command;
      args: any[];
    }

    type CommandManagerCallback = (obj: CommandEvent) => void;

    export interface CommandManager {
      on(name: 'afterExec', callback: CommandManagerCallback): void;
    }

    // Allows calling `execCommand` with no arguments:
    //
    // editor.execCommand('startAutocomplete');
    //
    // WARNING: this should probably replace the existing definition, not in addition.
    export interface Editor {
      execCommand(name: string | string[], args?: any): any;
    }
  }
}
