import { pushGuestFsQueue, sleep } from "kymano";
import { mounted } from "kymano/dist/global";
import { basename } from "path";
import * as vscode from "vscode";
import { DiskTreeItem } from "./diskTreeitem";
import { CantConnectDiskException } from "./Exceptions/CantConnectDiskException";
import { CantConnectToSftpHostException } from "./Exceptions/CantConnectToSftpHostException";
import { SFtpNode } from "./SFtpNodeInterface";
let Client = require("ssh2-sftp-client");
const fs = require("fs");
const isBinaryFile = require("isbinaryfile").isBinaryFile;
var bytes = require("bytes");

export class SFtpService {
  constructor(readonly host: string) {}

  public connect(): Thenable<Client> {
    return new Promise(async (c, e) => {
      const client = await new Client();

      console.log(`src/SFtpService.ts:19 host`, this.host);
      let i = 0;
      while (true) {
        i++;
        try {
          await client.connect({
            host: this.host,
            port: 22,
            username: "root",
            password: "root",
            retries: 50,
            readyTimeout: 1000,
            retry_minTimeout: 500,
            retry_factor: 1,
          });
          break;
        } catch (err) {
          console.log(`src/SFtpService.ts:29 while (true)`, err);
          await sleep(1);
          if (i > 30) {
            CantConnectToSftpHostException(this.host);

            break;
          }
        }
      }
      c(client);
    });
  }

  private makeItem(entry, resource) {
    const item = {
      resource: vscode.Uri.parse(resource),
      isDirectory: entry.type === "d",
      isLink: entry.type === "l",
      tooltip: bytes(entry.size),
    };
    if (entry.type === "l") {
      item.tooltip = "Symlink";
    }
    if (entry.type === "d") {
      item.tooltip = "Directory";
    }
    console.log(`src/SFtpService.ts:51 item`, item);

    return item;
  }

  public roots(disk: DiskTreeItem): Thenable<SFtpNode[]> {
    return this.connect()
      .then((client) => {
        return new Promise(async (c, e) => {
          console.log("roots sftp", disk);
          try {
            let mountedKey = `${disk.diskId}`;
            if (disk.myConfigId) {
              mountedKey = `${disk.myConfigId}-${disk.name}`;
            }

            console.log(`src/SFtpService.ts:37 mountedpushGuestFsQueue`, mounted);
            if (disk.vmName === "disk") {
              pushGuestFsQueue({
                name: "addNewDiskToGuestFs",
                param: `${disk.diskId}`,
              });
            } else {
              pushGuestFsQueue({
                name: "addNewVmDriveToGuestFs",
                param: `${disk.myConfigId}-${disk.name}`,
              });
            }
            await new Promise((resolve) => {
              (function myLoop(i: number) {
                setTimeout(function () {
                  i++;
                  console.log(`src/SFtpService.ts:45 sleep`, i, disk, mounted);
                  if (i > 60) {
                    console.log(`src/SFtpService.ts:48 !!!resolve`, i, `${disk}`, mounted);
                    resolve();
                  } else if (
                    !mounted[`${mountedKey}`] ||
                    (mounted[`${mountedKey}`] && mounted[`${mountedKey}`].status !== "done")
                  ) {
                    myLoop(i);
                  } else {
                    const result = mounted[`${mountedKey}`];
                    console.log(`src/SFtpService.ts:48 resolve`, i, `${disk}`, mounted);
                    console.log(`src/SFtpService.ts:48 resolve`, result);
                    if (result.result && result.result[0]) {
                      try {
                        let jsonResponse = JSON.parse(result.result[0]);
                        console.log(`jsonResponse`, jsonResponse);
                        if (jsonResponse.error) {
                          CantConnectDiskException(jsonResponse.message, disk);
                        } else if (jsonResponse.result !== "mounted") {
                          CantConnectDiskException("", disk);
                        }
                      } catch (err) {
                        console.log(`src/SFtpService.ts:115 JSON.parse`, result.result[0]);
                      }
                    }
                    mounted[`${mountedKey}`] = { status: "no" };
                    resolve();
                  }
                }, 500);
              })(0);
            });
            console.log(`src/SFtpService.ts:51 client.list`);
            let path = `${disk.myConfigId}-${disk.name}`;
            if (disk.vmName === "disk") {
              path = `${disk.diskId}`;
            }
            client
              .list(`/mnt/kymano/${path}`)
              .then((list) => {
                console.log("roots list", list);
                const newlist = list.map((entry) => {
                  return this.makeItem(entry, `sftp://${this.host}/mnt/kymano/${path}/${entry.name}`);
                });
                console.log(`src/sftpExplorer.ts:59 newlist`, newlist);
                return c(this.sort(newlist));
              })
              .catch((error) => {
                console.log(`src/SFtpService.ts:88 error`, error);
                return c(null);
              });
          } catch (error) {
            console.log(`src/sftpExplorer.ts:63 error`, error);
          }
        });
      })
      .catch((error) => {
        console.log(`src/SFtpService.ts:88 conn error`, error);
        return null;
      });
  }

  public getChildren(node: SFtpNode): Thenable<SFtpNode[]> {
    return this.connect()
      .then((client) => {
        return new Promise((c, e) => {
          try {
            client
              .list(node.resource.fsPath)
              .then((list) => {
                console.log("roots list", list);
                console.dir(list);
                client.end();
                const newlist = list.map((entry) => {
                  return this.makeItem(entry, `sftp://${this.host}${node.resource.fsPath}/${entry.name}`);
                });
                console.log(newlist);
                return c(this.sort(newlist));
              })
              .catch((error) => {
                console.log(`src/SFtpService.ts:88 error`, error);
                return c(null);
              });
          } catch (error) {
            console.log(`src/sftpExplorer.ts:93 error`, error);
          }
        });
      })
      .catch((error) => {
        console.log(`src/SFtpService.ts:146 conn error`, error);
        return null;
      });
  }

  private sort(nodes: SFtpNode[]): SFtpNode[] {
    return nodes.sort((n1, n2) => {
      if (n1.isDirectory && !n2.isDirectory) {
        return -1;
      }

      if (!n1.isDirectory && n2.isDirectory) {
        return 1;
      }

      return basename(n1.resource.fsPath).localeCompare(basename(n2.resource.fsPath));
    });
  }

  public getContent(resource: vscode.Uri): Thenable<string> {
    console.log(`src/sftpExplorer.ts:121 getContent`, resource);
    return this.connect()
      .then((client) => {
        return new Promise((c, e) => {
          try {
            console.log(`src/sftpExplorer.ts:121 client.get`, resource);
            client
              .get(resource.path)
              .then((data) => {
                isBinaryFile(data, data.length).then((isBinary) => {
                  console.log(`src/sftpExplorer.ts:123 isBinaryFile`, isBinary);
                  if (isBinary) {
                    vscode.window
                      .showSaveDialog({
                        defaultUri: vscode.Uri.file(basename(resource.path)),
                      })
                      .then((fileInfos) => {
                        if (!fileInfos) {
                          return;
                        }
                        fs.writeFileSync(fileInfos.path, data);
                        vscode.window.showInformationMessage(`Saved to ${fileInfos.path}`);
                      });
                  } else {
                    return c(data.toString());
                  }
                });
              })
              .catch((error) => {
                console.log(`src/SFtpService.ts:88 error`, error);
                return c(null);
              });
          } catch (error) {
            console.log(`src/sftpExplorer.ts:129 error`, error);
          }
        });
      })
      .catch((error) => {
        console.log(`src/SFtpService.ts:203 conn error`, error);
        return null;
      });
  }
}
