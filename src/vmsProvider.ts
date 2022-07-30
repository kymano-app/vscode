import * as vscode from "vscode";
import { KymanoAdapter } from "./kymanoAdapter";
import { VirtualMachineTreeItem } from "./vmTreeitem";

export class VirtualMachinesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<VirtualMachineTreeItem | undefined> = new vscode.EventEmitter<
    VirtualMachineTreeItem | undefined
  >();
  readonly onDidChangeTreeData: vscode.Event<VirtualMachineTreeItem | undefined> = this._onDidChangeTreeData.event;

  // constructor() {
  // 	const view = vscode.window.createTreeView('vb-machines', { treeDataProvider: this, showCollapseAll: true, canSelectMany: true, dragAndDropController: this });
  // }

  constructor(private readonly kymanoAdapter: KymanoAdapter) {}

  refresh(item?: VirtualMachineTreeItem): void {
    this._onDidChangeTreeData.fire(item);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
    return this.kymanoAdapter.getAllVms()
      .then((vms) => vms.map((vm) => new VirtualMachineTreeItem(vm)))
      .catch((err) => {
        vscode.window.showErrorMessage(err);
        return [];
      });
  }
}

export class MyVirtualMachinesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<VirtualMachineTreeItem | undefined> = new vscode.EventEmitter<
    VirtualMachineTreeItem | undefined
  >();
  constructor(private readonly kymanoAdapter: KymanoAdapter) {}

  readonly onDidChangeTreeData: vscode.Event<VirtualMachineTreeItem | undefined> = this._onDidChangeTreeData.event;

  refresh(item?: VirtualMachineTreeItem): void {
    this._onDidChangeTreeData.fire(item);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    console.log(`src/vmsProvider.ts:35 TreeItem.label=`, element.label);
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
    console.log(`src/vmsProvider.ts:35 getChildren=`);

    return this.kymanoAdapter.getMyVms()
      .then((vms) => vms.map((vm) => new VirtualMachineTreeItem(vm)))
      .catch((err) => {
        vscode.window.showErrorMessage(err);
        return [];
      });
  }
}
