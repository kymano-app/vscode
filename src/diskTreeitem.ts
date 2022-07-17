import * as vscode from "vscode";
import { Disk } from "./utils";

export class DiskTreeItem extends vscode.TreeItem {
  vmName: string;
  name: string;
  myConfigId?: number;
  diskId?: number;
  constructor(public readonly disk: Disk) {
    super(disk.name);

    this.id = disk.id;
    this.myConfigId = disk.myConfigId;
    this.diskId = disk.diskId;
    this.description = `(${disk.vmName})`;
    if (disk.icon) {
      this.iconPath = new (vscode.ThemeIcon as any)(disk.icon);
    } else {
      this.iconPath = new (vscode.ThemeIcon as any)("folder");
    }
    if (disk.notCollapsed) {
      this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    } else {
      this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }
    this.vmName = disk.vmName;
    this.name = disk.name;
    const newTree = this;
    newTree.command = null;
    if (disk.command) {
      this.command = disk.command;
    } else {
      this.command = {
        command: "myDisks.open",
        arguments: [newTree],
        title: "Open",
      };
    }
  }
}
