import * as vscode from 'vscode';

export function registerCommands(context: vscode.ExtensionContext) {
    console.log('registerCommands in keymap')

    const emacsExt = new EmacsExt();

    // ctrl+k : delete line
    let command = vscode.commands.registerCommand('minimal-emacs.ctrl+k', () => {
        emacsExt.deleteLine()
    });
    context.subscriptions.push(command);

    console.log('registerCommands in keymap done')
}

class EmacsExt {
    private _textBuffer: string;
    private _pos_atTextBufferred: vscode.Position;

    constructor() {
        this._textBuffer = ''
        this._pos_atTextBufferred = new vscode.Position(0, 0);
    }

    private checkState() {
        return vscode.window.activeTextEditor;
    }

    public deleteLine() {
        if (!this.checkState()) {
            return;
        }
        //console.log('delete line ' + this._pos_atTextBufferred.line + ',' + this._pos_atTextBufferred.character + ' ' + this._textBuffer)
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let line = editor.document.lineAt(editor.selection.active)
        if (!line) {
            return;
        }
        //console.log(line)

        let selection = editor?.selection
        if (!selection) {
            return;
        }

        let endPos = new vscode.Position(selection.start.line, line.text.length)
        console.log(selection.start.character)
        console.log(line.text.length)
        if (selection.start.character == line.text.length) {
            // New line
            endPos = new vscode.Position(selection.start.line+1, 0)
        }

        let target = new vscode.Selection(selection.start, endPos)
        let text = editor?.document.getText(target)
        //console.log('remove ' + text)
        editor.edit(builder => builder.delete(target))

        if (selection.start == this._pos_atTextBufferred) {
            this._textBuffer += text
        } else {
            this._textBuffer = text
        }
        this._pos_atTextBufferred = selection.start
        //console.log('textBuffer ' + this._textBuffer)
    }
}