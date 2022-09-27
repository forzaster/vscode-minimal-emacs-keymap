import * as vscode from 'vscode';


export function registerCommands(context: vscode.ExtensionContext) {
    console.log('registerCommands in keymap')

    const emacsExt = new EmacsExt();

    function registerCommand(commandid: string, command_func: (...args: any[]) => any) {
        let command = vscode.commands.registerCommand(commandid, command_func);
        context.subscriptions.push(command);    
    }

    // ctrl+k : delete line
    registerCommand('minimal-emacs.ctrl+k', () => {
        emacsExt.deleteLine()
    });
    // ctrl+y : paste text buffer
    registerCommand('minimal-emacs.ctrl+y', () => {
        emacsExt.pasteTextBuffer()
    });

    console.log('registerCommands in keymap done')
}

class EmacsExt {
    private _textBuffer: string;
    private _posAtTextBufferred: vscode.Position;

    constructor() {
        this._textBuffer = ''
        this._posAtTextBufferred = new vscode.Position(0, 0);
    }

    private checkState() {
        return vscode.window.activeTextEditor;
    }

    public deleteLine() {
        if (!this.checkState()) {
            return;
        }

        let editor = vscode.window.activeTextEditor;
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

        let endPos = new vscode.Position(selection.start.line, line.text.length)
        if (selection.start.character == line.text.length) {
            // New line
            endPos = new vscode.Position(selection.start.line+1, 0)
        }

        let target = new vscode.Selection(selection.start, endPos)
        let text = editor?.document.getText(target)
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
        if (!this.checkState()) {
            return;
        }

        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let selection = editor.selection
        if (!selection) {
            return;
        }

        editor.edit(builder => builder.insert(selection.start, this._textBuffer))
    }
}