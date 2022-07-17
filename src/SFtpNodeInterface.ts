import * as vscode from "vscode";

export interface SFtpNode {
  resource: vscode.Uri;
  isDirectory: boolean;
  tooltip: string;
  isLink: boolean;
  id: Number;
  name: String;
  vmName: string;
}