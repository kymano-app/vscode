import * as vscode from "vscode";
import { DiskTreeItem } from "./diskTreeitem";
import { SFtpService } from "./SFtpService";

export class SFtpTreeDataProvider implements vscode.TextDocumentContentProvider {
  private _onDidChangeTreeData: vscode.EventEmitter<DiskTreeItem | undefined> = new vscode.EventEmitter<
    DiskTreeItem | undefined
  >();
  constructor(private readonly model: SFtpService) {}

  readonly onDidChangeTreeData: vscode.Event<DiskTreeItem | undefined> = this._onDidChangeTreeData.event;

  refresh(item?: DiskTreeItem): void {
    this._onDidChangeTreeData.fire(item);
  }
  
  public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
    console.log(`src/sftpExplorer.ts:236 provideTextDocumentContent`);
    return this.model.getContent(uri).then((content) => content);
  }
}
