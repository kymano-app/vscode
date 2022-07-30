import { DataSource, getUserDataPath, Kymano, QemuCommands } from "kymano";
import { mounted } from "kymano/dist/global";
import * as vscode from "vscode";
import { DiskTreeItem } from "./diskTreeitem";
import { SFtpNode } from "./SFtpNodeInterface";
import { SFtpService } from "./SFtpService";
import { KymanoAdapter } from "./kymanoAdapter";
import path = require("path");
const fs = require("fs");

var selected;
var importing = null;
var loadingQemuImg = true;

export class MyDisksProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DiskTreeItem | undefined> = new vscode.EventEmitter<
    DiskTreeItem | undefined
  >();
  view: vscode.TreeView<T>;

  constructor(private readonly model: SFtpService, private readonly kymanoAdapter: KymanoAdapter) {
    this.view = vscode.window.createTreeView("my-disks", {
      treeDataProvider: this,
    });
  }

  readonly onDidChangeTreeData: vscode.Event<DiskTreeItem | undefined> = this._onDidChangeTreeData.event;

  refresh(): void {
    console.log(`src/MyDisksProvider.ts:17 refreshALL`);
    vscode.commands.executeCommand("workbench.actions.treeView.my-disks.collapseAll");
    this._onDidChangeTreeData.fire();
  }

  refreshOne(item?: DiskTreeItem): void {
    console.log(`src/MyDisksProvider.ts:17 refreshONE`);
    this.view.reveal(item, { focus: true, select: true, expand: true });
    this._onDidChangeTreeData.fire(item);
  }

  refreshOneWithoutReveal(item?: DiskTreeItem): void {
    console.log(`src/MyDisksProvider.ts:17 refreshOneWithoutReveal`);
    this._onDidChangeTreeData.fire(item);
  }

  open(item?: DiskTreeItem): void {
    console.log(`open`, item);
    //item?.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

    if (selected && selected !== item) {
      if (selected.myConfigId) {
        mounted[`${selected.myConfigId}-${selected.name}`] = { status: "no" };
      } else {
        mounted[`${selected.diskId}`] = { status: "no" };
      }
      this._onDidChangeTreeData.fire(selected);
      vscode.commands.executeCommand("workbench.actions.treeView.my-disks.collapseAll");
      console.log(`src/MyDisksProvider.ts:54 collapseAll`);
    }
    if (selected !== item) {
      this.model.connect().then(() => {
        console.log(`connect:::::::::`);
        item.icon = "folder";
        item.waitingForSshConnection = undefined;
        this.refreshOne(item);
      });

      item.icon = "loading~spin";
      item.waitingForSshConnection = true;
      this.refreshOne(item);
    }
    if (selected === item && item?.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
      this.view.reveal(item, { focus: true, select: true, expand: true });
    }
    selected = item;
  }

  // resolveTreeItem?(
  //   item: vscode.TreeItem,
  //   element: T,
  //   token: vscode.CancellationToken
  // ): vscode.ProviderResult<vscode.TreeItem> {
  //   console.log(`src/MyDisksProvider.ts:36 resolveTreeItem`, item);
  //   return item;
  // }

  getParent(element: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem> {
    console.log(`src/MyDisksProvider.ts:32 getParent?(element: T): ProviderResult<T>;`, element);
    return null;
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    console.log(`MyDisksProvider getTreeItem`, element);
    if (!element || element.loadingQemuImg) {
      return element;
    } else if (element.vmName) {
      if (element.icon) {
        element.iconPath = new (vscode.ThemeIcon as any)(element.icon);
      }
      return element;
    }
    console.log(`MyDisksProvider getTreeItem resource`, element);
    const item = {
      resourceUri: element.resource,
      collapsibleState: element.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : void 0,
      command: element.isDirectory
        ? void 0
        : {
            command: "myDisks.openSFtpResource",
            arguments: [element.resource],
            title: "Open",
          },
      tooltip: element.tooltip,
    };

    return item;
  }

  getChildren(
    element?: vscode.TreeItem | SFtpNode
  ): vscode.ProviderResult<vscode.TreeItem[]> | vscode.TreeItem[] | SFtpNode[] | Thenable<SFtpNode[]> {
    console.log(`MyDisksProvider getChildren`, element);

    if (selected && element && element.command && element !== selected) {
      return undefined;
    }
    if (element && element.waitingForSshConnection) {
      return;
    }

    if (!element && loadingQemuImg) {
      new Promise(async (resolve, reject) => {
        const disks = await this.kymanoAdapter.getMyDisks()
          .then((disks) => {
            let disks_ = [];
            console.log(`src/MyDisksProvider.ts:150 importing`, importing);
            const diskUpload = new DiskTreeItem({
              id: "9999",
              name: "Import from VirtualBox, Parallels, VMware ...",
              vmName: "-",
              icon: "add",
              notCollapsed: true,
            });
            diskUpload.command = { command: "myDisks.upload", arguments: [diskUpload], title: "Open" };

            disks_.push(diskUpload);
            disks_ = [...disks_, ...disks.map((disk) => new DiskTreeItem(disk))];

            return;
          })
          .catch((err) => {
            vscode.window.showErrorMessage(err);
            return [];
          });
      });

      return [
        {
          id: "1000001",
          loadingQemuImg: true,
          iconPath: new (vscode.ThemeIcon as any)("gear~spin"),
          label: "%",
          description: "importing",
          tooltip: "importing",
          command: undefined,
        },
      ];
    }

    if (element.vmName) {
      console.log(`MyDisksProvider getChildren roots`, element);
      return this.model.roots(element);
    }

    return this.model.getChildren(element);
  }

  public provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
    console.log(`provideTextDocumentContent`);
    return this.model.getContent(uri).then((content) => content);
  }
}
