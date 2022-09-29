import {ExtensionContext, commands, Position, Selection, window} from 'vscode';


export function registerCommands(context: ExtensionContext) {
    function registerCommand(commandid: string, command_func: (...args: any[]) => any) {
        let command = commands.registerCommand(commandid, command_func);
        context.subscriptions.push(command);    
    }

    const emacsExt = new EmacsExt();

    registerCommand('minimal-emacs.ctrl+k', () => {
        emacsExt.deleteLine()
    });
    registerCommand('minimal-emacs.ctrl+y', () => {
        emacsExt.pasteTextBuffer()
    });
    registerCommand('minimal-emacs.ctrl+space', () => {
        emacsExt.toggleSelectionAnchor()
    });
    registerCommand('minimal-emacs.ctrl+w', () => {
        emacsExt.copySelection(true)
    });

    console.log('registerCommands in keymap done')
}

class EmacsExt {
    private _textBuffer: string;
    private _posAtTextBufferred: Position;
    private _selectMode: boolean = true;

    constructor() {
        this._textBuffer = ''
        this._posAtTextBufferred = new Position(0, 0);
        this.toggleSelectionAnchor()
    }

    private setFlag(name: string, v: boolean) {
        commands.executeCommand('setContext', name, v);
    }

    public deleteLine() {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let line = editor.document.lineAt(editor.selection.active)
        if (!line) {
            return;
        }
        //console.log(line)

        let selection = editor.selection
        if (!selection) {
            return;
        }

        let endPos = new Position(selection.start.line, line.text.length)
        if (selection.start.character == line.text.length) {
            // New line
            endPos = new Position(selection.start.line+1, 0)
        }

        let target = new Selection(selection.start, endPos)
        let text = editor.document.getText(target)
        //console.log('remove ' + text)
        editor.edit(builder => builder.delete(target))

        if (selection.start == this._posAtTextBufferred) {
            this._textBuffer += text
        } else {
            this._textBuffer = text
        }
        this._posAtTextBufferred = selection.start
        //console.log('textBuffer ' + this._textBuffer)
    }

    public pasteTextBuffer() {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let selection = editor.selection
        if (!selection) {
            return;
        }

        editor.edit(builder => builder.insert(selection.start, this._textBuffer))
    }

    public toggleSelectionAnchor() {
        let mode = !this._selectMode
        this.setFlag('emacsKey.selectMode', mode)
        this._selectMode = mode

        if (!this._selectMode && !this._textBuffer) {
            let editor = window.activeTextEditor;
            if (!editor) {
                return;
            }
            editor.selection = new Selection(editor.selection.active, editor.selection.active)
        }
    }

    public copySelection(is_cut: boolean) {
        if (!this._selectMode) {
            return
        }
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let selection = editor.selection
        if (!selection) {
            return;
        }

        let text = editor.document.getText(selection)
        if (is_cut) {
            editor.edit(builder => builder.delete(selection))
        }
        this._textBuffer = text
        this._posAtTextBufferred = new Position(0, 0)

        this.toggleSelectionAnchor()
    }
}