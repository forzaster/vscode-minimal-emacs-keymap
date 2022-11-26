import {window, workspace, Uri, QuickPickItem, QuickInputButton, QuickPickItemKind} from 'vscode';
import path = require('path');


function getRootPath() {
    if (!workspace.workspaceFolders) {
        return ''
    }
    let rootpath = workspace.workspaceFolders[0].uri.path.concat('/')
    console.log('rootpath='.concat(rootpath))
    return rootpath
}

export function getUpperFolderPath(targetpath: string) {
    let folderpath = path.dirname(targetpath)

    if (folderpath == '.') {
        return ''
    }
    return folderpath.concat('/')
}

export abstract class AbsFileItem implements QuickPickItem {
    rootpath: string
    targetpath: string;
    label: string;
    kind?: QuickPickItemKind | undefined;
    description?: string | undefined;
    detail?: string | undefined;
    picked?: boolean | undefined;
    alwaysShow?: boolean | undefined;
    buttons?: readonly QuickInputButton[] | undefined;

    constructor(targetpath: string) {
        this.rootpath = getRootPath()
        this.targetpath = targetpath
        this.label = targetpath.replace(this.rootpath, '')
    }

    abstract open(): void;
}

export class FileItem extends AbsFileItem {

    constructor(targetpath: string) {
        super(targetpath)
    }

    public open(): void {
        let openpath = 'file://'.concat(this.targetpath)
        console.log('openpath='.concat(openpath))
        workspace.openTextDocument(Uri.parse(openpath)).then(doc => {
            window.showTextDocument(doc)
        })

    }
}

export class FileContainer extends AbsFileItem{

    constructor(targetpath: string) {
        super(targetpath);
    }

    private convertToQuickPickDisplayString(urls: Uri[]) {
        let urlstrs = urls.map(url => {
            let urlstr = url.toString()
            return urlstr.replace('file://', '')
        })
        return urlstrs
    }

    private showFileListDialog(files: AbsFileItem[]) {
        window.showQuickPick(files).then(selected => {
            if (selected) {
                selected.open()
            }
        })
    }

    public open(): void {
        let relativepath = this.targetpath.replace(this.rootpath, '')
        let findarg = relativepath.concat('*')
        console.log('1 targetpath='.concat(this.targetpath, ', findarg=', findarg))
        let files_thenable: Thenable<AbsFileItem[]> = workspace.findFiles(findarg).then(urls => {
            return this.convertToQuickPickDisplayString(urls).map(itempath => {
                return new FileItem(itempath)
            })
        }).then(files => {
            // add upper folder
            if (relativepath != '') {
                let parentpath = getUpperFolderPath(this.targetpath)
                console.log('2 findpath='.concat(relativepath, ', parentpath=', parentpath))
                let c = new FileContainer(parentpath)
                c.label = '..'
                files.push(c)
            }
            return files
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
                    return new FileContainer(f)
                }))

                if (items) {
                    this.showFileListDialog(items)
                } else {
                    window.showInformationMessage('No files')
                }
            })
        })
    }
}