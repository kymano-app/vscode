import * as vscode from "vscode";
import { SFtpService } from "./SFtpService";
import { SFtpTreeDataProvider } from "./SFtpTreeDataProvider";

export class SFtpExplorer {
  //sftpViewer: vscode.TreeView<unknown>;

  constructor(context: vscode.ExtensionContext) {
    const sftpService = new SFtpService("192.168.66.2");
    const treeDataProvider = new SFtpTreeDataProvider(sftpService);
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("sftp", treeDataProvider));

    //this.sftpViewer = vscode.window.createTreeView('myDisks', { treeDataProvider });
    //vscode.commands.registerCommand("myDisks.refresh", () => treeDataProvider.refresh());
    vscode.commands.registerCommand("myDisks.openSFtpResource", (resource) => this.openResource(resource));
		//vscode.commands.registerCommand('myDisks.revealResource', () => this.reveal());
  }

  private openResource(resource: vscode.Uri): void {
    console.log(`openResource`, resource);
    vscode.window.showTextDocument(resource);
  }
}
