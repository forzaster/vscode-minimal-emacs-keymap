import {ExtensionContext, commands, Position, Selection, window, workspace} from 'vscode';
import {getUpperFolderPath, FileContainer, FileItem, GetRootPath} from './fileItem';


export function registerCommands(context: ExtensionContext) {
    function registerCommand(commandid: string, command_func: (...args: any[]) => any) {
        let command = commands.registerCommand(commandid, command_func);
        context.subscriptions.push(command);    
    }

    const emacsExt = new EmacsExt();

    registerCommand('minimal-emacs.ctrl+k', () => {
        emacsExt.deleteLine();
    });
    registerCommand('minimal-emacs.ctrl+y', () => {
        emacsExt.pasteTextBuffer();
    });
    registerCommand('minimal-emacs.ctrl+space', () => {
        emacsExt.toggleSelectionAnchor();
    });
    registerCommand('minimal-emacs.ctrl+w', () => {
        emacsExt.copySelection(true);
    });
    registerCommand('minimal-emacs.cmd+shift+,', () => {
        emacsExt.gotoTop();
    });
    registerCommand('minimal-emacs.cmd+shift+.', () => {
        emacsExt.gotoBottom();
    });
    registerCommand('minimal-emacs.ctrl+v', () => {
        emacsExt.moveLargeDown();
    });
    registerCommand('minimal-emacs.ctrl+x.ctrl+f', () => {
        emacsExt.openFile();
    });
    registerCommand('minimal-emacs.ctrl+x.ctrl+b', () => {
        emacsExt.openHistory();
    });

    workspace.onDidOpenTextDocument(event => {
        if (emacsExt.isHistoryFiles(event.uri.scheme)) {
            emacsExt.updateHistories([event.fileName])
        }
    })

    console.log('registerCommands in keymap done');
}


class EmacsExt {
    private _textBuffer: string;
    private _posAtTextBufferred: Position;
    private _selectMode: boolean = true;
    private _fileHistory: string[] = [];
    private _HISTORY_MAX: number = 100;

    constructor() {
        this._textBuffer = '';
        this._posAtTextBufferred = new Position(0, 0);
        this.toggleSelectionAnchor();
    }

    private setFlag(name: string, v: boolean) {
        commands.executeCommand('setContext', name, v);
    }

    public deleteLine() {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let line = editor.document.lineAt(editor.selection.active);
        if (!line) {
            return;
        }
        //console.log(line)

        let selection = editor.selection;
        if (!selection) {
            return;
        }

        let endPos = new Position(selection.start.line, line.text.length);
        if (selection.start.character == line.text.length) {
            // New line
            endPos = new Position(selection.start.line+1, 0);
        }

        let target = new Selection(selection.start, endPos);
        let text = editor.document.getText(target);
        //console.log('remove ' + text)
        editor.edit(builder => builder.delete(target));

        if (selection.start == this._posAtTextBufferred) {
            this._textBuffer += text;
        } else {
            this._textBuffer = text;
        }
        this._posAtTextBufferred = selection.start;
        //console.log('textBuffer ' + this._textBuffer)
    }

    public pasteTextBuffer() {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let selection = editor.selection;
        if (!selection) {
            return;
        }

        editor.edit(builder => builder.insert(selection.start, this._textBuffer));
    }

    private resetSelection() {
        if (!this._selectMode && !this._textBuffer) {
            let editor = window.activeTextEditor;
            if (!editor) {
                return;
            }
            editor.selection = new Selection(editor.selection.active, editor.selection.active);
        }
    }

    public toggleSelectionAnchor() {
        let mode = !this._selectMode;
        this.setFlag('emacsKey.selectMode', mode);
        this._selectMode = mode;

        this.resetSelection();
    }

    public copySelection(is_cut: boolean) {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let selection = editor.selection;
        if (!selection) {
            return;
        }

        let text = editor.document.getText(selection);
        if (is_cut) {
            editor.edit(builder => builder.delete(selection));
        }
        this._textBuffer = text;
        this._posAtTextBufferred = new Position(0, 0);

        if (this._selectMode) {
            this.toggleSelectionAnchor();
        } else {
            this.resetSelection();
        }
    }

    public gotoTop() {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let selection = editor.selection;
        if (!selection) {
            return;
        }
        editor.selection = new Selection(new Position(0, 0), new Position(0, 0));
        commands.executeCommand('scrollEditorTop');
    }

    public gotoBottom() {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }

        let bottom = editor.document.lineCount - 1;
        editor.selection = new Selection(new Position(bottom, 0), new Position(bottom, 0));
        commands.executeCommand('cursorLineEnd');
        commands.executeCommand('scrollEditorBottom');
    }
    
    public moveDelta(delta: number) {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let selection = editor.selection;
        if (!selection) {
            return;
        }

        let line = editor.document.lineAt(editor.selection.active);
        let target = line.lineNumber + delta;

        if (target < 0) {
            target = 0;
        }
        if (target >= editor.document.lineCount) {
            target = editor.document.lineCount - 1;
        }

        editor.selection = new Selection(new Position(target, 0), new Position(target, 0));
        commands.executeCommand('cursorLineStart');
    }

    public moveLargeDown() {
        this.moveDelta(50);
    }

    public moveLargeUp() {
        this.moveDelta(-10);
    }

    public openFile() {
        let curfile = window.activeTextEditor?.document.fileName;
        if (!curfile) {
            return;
        }

        let findpath = getUpperFolderPath(curfile);
        let item = new FileContainer(findpath);
        item.open();
    }

    public updateHistory(filename: string) {
        let idx = this._fileHistory.indexOf(filename)
        if (idx >= 0) {
            this._fileHistory.splice(idx, 1)
        }
        this._fileHistory.push(filename)

        if (this._fileHistory.length >= this._HISTORY_MAX) {
            this._fileHistory = this._fileHistory.slice(1)
        }
    }

    public updateHistories(filenames: string[]) {
        filenames.map(f => {
            if (f.endsWith('.git')) {
                return;
            }
            this.updateHistory(f);
        })
    }

    public isHistoryFiles(scheme: string) {
        return scheme == "file" || scheme == "vscode-notebook-cell";
    }

    public openHistory() {
        let fileNames2 = workspace.textDocuments.filter(f => {
            return this.isHistoryFiles(f.uri.scheme);
        }).map(f => {
            return f.fileName;
        })
        let fileNames = this._fileHistory.concat(fileNames2)

        let rootPath = GetRootPath()
        fileNames = Array.from(new Set(fileNames)).filter(f => {
            return f.startsWith(rootPath)
        }).sort()

        let files = fileNames.map(f => {
            return new FileItem(f);
        })
        window.showQuickPick(files).then(selected => {
            if (selected) {
                selected.open();
            }
        })
    }
}