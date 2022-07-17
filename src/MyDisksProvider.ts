import { DataSource, getUserDataPath, Kymano, QemuCommands } from "kymano";
import { mounted } from "kymano/dist/global";
import * as vscode from "vscode";
import { DiskTreeItem } from "./diskTreeitem";
import { SFtpNode } from "./SFtpNodeInterface";
import { SFtpService } from "./SFtpService";
import { getMyDisks } from "./utils";
const fs = require("fs");

var selected;

const db = require("better-sqlite3")(getUserDataPath() + "/sqlite3.db", {
  verbose: console.log,
});
const dataSource = new DataSource(db);
const kymano = new Kymano(dataSource, new QemuCommands());

export class MyDisksProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DiskTreeItem | undefined> = new vscode.EventEmitter<
    DiskTreeItem | undefined
  >();
  view: vscode.TreeView<T>;

  constructor(private readonly model: SFtpService) {
    this.view = vscode.window.createTreeView("my-disks", {
      treeDataProvider: this,
    });
  }

  readonly onDidChangeTreeData: vscode.Event<DiskTreeItem | undefined> = this._onDidChangeTreeData.event;

  refresh(): void {
    console.log(`src/MyDisksProvider.ts:17 refreshALL`);
    this._onDidChangeTreeData.fire();
  }

  refreshOne(item?: DiskTreeItem): void {
    console.log(`src/MyDisksProvider.ts:17 refreshONE`);
    this.view.reveal(item, { focus: true, select: true, expand: true });
    this._onDidChangeTreeData.fire(item);
  }

  open(item?: DiskTreeItem): void {
    console.log(`open`, item);
    //item?.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;

    if (selected && selected !== item) {
      if (selected.myConfigId) {
        mounted[`${selected.myConfigId}-${selected.name}`] = "no";
      } else {
        mounted[`${selected.diskId}`] = "no";
      }
      this._onDidChangeTreeData.fire(selected);
      vscode.commands.executeCommand("workbench.actions.treeView.my-disks.collapseAll");
      console.log(`src/MyDisksProvider.ts:54 collapseAll`);
    }
    if (selected !== item) {
      this.refreshOne(item);
    }
    if (selected === item && item?.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
      this.view.reveal(item, { focus: true, select: true, expand: true });
    }
    selected = item;
  }

  upload(): void {
    vscode.window.showOpenDialog().then((fileInfos) => {
      console.log(`src/MyDisksProvider.ts:58 fileInfos`, fileInfos);
      if (!fileInfos) {
        return;
      }
      kymano.importDisk(fileInfos[0].path, "new VM2").then(() => {
        this.refresh();
        vscode.window.showInformationMessage(`Done`);
      });

      //fs.writeFileSync(fileInfos.path, data);
      //vscode.window.showInformationMessage(`Saved to ${fileInfos.path}`);
    });
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
    if (!element) {
      return element;
    } else if (element.vmName) {
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

    if (!element) {
      return getMyDisks()
        .then((disks) => {
          let disks_ = [];
          disks_ = [...disks_, ...disks.map((disk) => new DiskTreeItem(disk))];
          disks_.push(
            new DiskTreeItem({
              id: "9999",
              name: "Import from VirtualBox, Parallels, VMware ...",
              vmName: "-",
              icon: "add",
              notCollapsed: true,
              command: { command: "myDisks.upload", arguments: [], title: "Open" },
            })
          );
          return disks_;
        })
        .catch((err) => {
          vscode.window.showErrorMessage(err);
          return [];
        });
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
