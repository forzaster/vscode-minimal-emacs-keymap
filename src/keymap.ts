import {ExtensionContext, commands, Position, Selection, window, workspace, Uri, QuickPickItem, QuickInputButton, QuickPickItemKind} from 'vscode';
import path = require('path');

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
    registerCommand('minimal-emacs.cmd+shift+,', () => {
        emacsExt.gotoTop()
    });
    registerCommand('minimal-emacs.cmd+shift+.', () => {
        emacsExt.gotoBottom()
    });
    registerCommand('minimal-emacs.ctrl+v', () => {
        emacsExt.moveLargeDown()
    });
    registerCommand('minimal-emacs.ctrl+x.ctrl+f', () => {
        emacsExt.openFile()
    });

    console.log('registerCommands in keymap done')
}


function getUpperFolderPath(targetpath: string) {
    let filename = path.basename(targetpath)
    let folderpath = path.dirname(targetpath)

    if (filename) {
        return folderpath.concat('/')
    }

    return path.dirname(folderpath).concat('/')
}


abstract class AbsFileItem implements QuickPickItem {
    rootpath!: string;
    targetpath: string
    label: string;
    kind?: QuickPickItemKind | undefined;
    description?: string | undefined;
    detail?: string | undefined;
    picked?: boolean | undefined;
    alwaysShow?: boolean | undefined;
    buttons?: readonly QuickInputButton[] | undefined;

    constructor(rootpath: string, label: string, targetpath: string) {
        this.rootpath = rootpath
        this.label = label
        this.targetpath = targetpath
    }

    abstract open(): void;
}

class FileItem 	extends AbsFileItem {

    constructor(rootpath: string, label: string, targetpath: string) {
        super(rootpath, label, targetpath);
    }

    public open(): void {
        let openpath = 'file://'.concat(this.rootpath, this.targetpath)
        console.log('openpath='.concat(openpath))
        workspace.openTextDocument(Uri.parse(openpath)).then(doc => {
            window.showTextDocument(doc)
        })

    }
}

class FileContainer extends AbsFileItem{
    constructor(rootpath: string, label: string, targetpath: string) {
        super(rootpath, label, targetpath);
    }

    private convertToQuickPickDisplayString(urls: Uri[]) {
        let urlstrs = urls.map(url => {
            let urlstr = url.toString()
            return urlstr.replace('file://', '').replace(this.rootpath, '')
        })
        return urlstrs
    }

    private showFileListDialog(files: AbsFileItem[], parentpath: string) {
        window.showQuickPick(files).then(selected => {
            if (selected) {
                selected.open()
            }
        })
    }

    public open(): void {
        let rootpath = this.rootpath
        let findpath = this.targetpath
        let findarg = findpath.replace(rootpath, '').concat('*')
        console.log('findpath='.concat(findarg))
        let files_thenable: Thenable<AbsFileItem[]> = workspace.findFiles(findarg).then(urls => {
            return this.convertToQuickPickDisplayString(urls).map(url => {
                return new FileItem(rootpath, url, url)
            })
        }).then(urls => {
            // add upper folder
            if (rootpath != findpath) {
                let newfindpath = getUpperFolderPath(findpath)
                urls.push(new FileContainer(rootpath, '..', newfindpath))
            }
            return urls
        })

        files_thenable.then(files => {
            // add sub folder
            workspace.findFiles(findarg.concat('/*')).then(urls => {
                let childfolders = new Set(this.convertToQuickPickDisplayString(urls).map(url => {
                    return getUpperFolderPath(url)
                }))
                console.log(childfolders)
                return [...childfolders]
            }).then(subfolders => {
                let items: AbsFileItem[] = files.concat(subfolders.map(f => {
                    return new FileContainer(rootpath, f, f)
                }))

                if (items) {
                    let newfindpath = getUpperFolderPath(findpath)
                    this.showFileListDialog(items, newfindpath)
                } else {
                    window.showInformationMessage('No files')
                }
    
            })

        })

    }
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

    private resetSelection() {
        if (!this._selectMode && !this._textBuffer) {
            let editor = window.activeTextEditor;
            if (!editor) {
                return;
            }
            editor.selection = new Selection(editor.selection.active, editor.selection.active)
        }
    }

    public toggleSelectionAnchor() {
        let mode = !this._selectMode
        this.setFlag('emacsKey.selectMode', mode)
        this._selectMode = mode

        this.resetSelection()
    }

    public copySelection(is_cut: boolean) {
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

        if (this._selectMode) {
            this.toggleSelectionAnchor()
        } else {
            this.resetSelection()
        }
    }

    public gotoTop() {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let selection = editor.selection
        if (!selection) {
            return;
        }
        editor.selection = new Selection(new Position(0, 0), new Position(0, 0))
        commands.executeCommand('scrollEditorTop')
    }

    public gotoBottom() {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }

        let bottom = editor.document.lineCount - 1
        editor.selection = new Selection(new Position(bottom, 0), new Position(bottom, 0))
        commands.executeCommand('cursorLineEnd')
        commands.executeCommand('scrollEditorBottom')
    }
    
    public moveDelta(delta: number) {
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        
        let selection = editor.selection
        if (!selection) {
            return;
        }

        let line = editor.document.lineAt(editor.selection.active)
        let target = line.lineNumber + delta

        if (target < 0) {
            target = 0
        }
        if (target >= editor.document.lineCount) {
            target = editor.document.lineCount - 1
        }

        editor.selection = new Selection(new Position(target, 0), new Position(target, 0))
        commands.executeCommand('cursorLineStart')
    }

    public moveLargeDown() {
        this.moveDelta(50)
    }

    public moveLargeUp() {
        this.moveDelta(-10)
    }

    private getRootPath() {
        if (!workspace.workspaceFolders) {
            return ''
        }
        let rootpath = workspace.workspaceFolders[0].uri.path.concat('/')
        console.log('rootpath='.concat(rootpath))
        return rootpath
    }

    public openFile() {
        let rootpath = this.getRootPath()
        if (!rootpath) {
            return
        }

        let curfile = window.activeTextEditor?.document.fileName
        if (!curfile) {
            return
        }

        let curfilename = path.basename(curfile)
        let findpath = getUpperFolderPath(curfile)
        console.log('current : path = '.concat(findpath, ', filename = ', curfilename))

        let item = new FileContainer(rootpath, findpath, findpath)
        item.open()
    }
}