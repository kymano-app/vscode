import {
  addDriveViaMonitor,
  DataSource,
  delDrives,
  execInGuestfs,
  getUserDataPath,
  ip,
  Kymano,
  QemuCommands,
  setIp,
  shiftGuestFsQueue,
  shiftMessagesQueue,
  isFileExist,
} from "kymano";
import { MessagesQueueStatus, mounted, pushMessagesQueue, shiftQemuImgConvertingQueue } from "kymano/dist/global";
import * as vscode from "vscode";
import { DiskTreeItem } from "./diskTreeitem";
import { CantConvertDiskException } from "./Exceptions/CantConvertDiskException";
import { pids } from "./global";
import { MyDisksProvider } from "./MyDisksProvider";
import { runGuestFs } from "./services";
import { SFtpExplorer } from "./sftpExplorer";
import { SFtpService } from "./SFtpService";
import { KymanoAdapter } from "./kymanoAdapter";
import { MyVirtualMachinesProvider, VirtualMachinesProvider } from "./vmsProvider";
import { VirtualMachineTreeItem } from "./vmTreeitem";
import path = require("path");
const fsAsync = require("fs").promises;

// (async function loop2() {
// 	setTimeout(async function () {
// 	  const command = shiftGuestFsQueue();
// 	  console.log('command2::::::', command, ip);
// 	  if (command && command.name === 'searchFileInGuestFs') {

// 	  }
// 	  loop2();
// 	}, 1000);
//   })();
(async function loop() {
  setTimeout(async function () {
    const command = shiftGuestFsQueue();
    console.log("command::::::", command, ip);
    if (command && command.name === "addNewDiskToGuestFs") {
      await execInGuestfs("kill `pidof ack` 2>/dev/null", "worker2");
      await execInGuestfs("kill `pidof find` 2>/dev/null", "worker2");
      await execInGuestfs("/bin/unmount 2>/dev/null", "worker1");
      const result2 = await delDrives();
      console.log(`src/extension.ts:60 result2`, result2);

      await addDriveViaMonitor(`${getUserDataPath()}/user_layers/disk/${command.param}`);
      await new Promise((resolve) => setTimeout(resolve, 1 * 1000));
      const result = await execInGuestfs("/bin/guestfs", "worker1");
      mounted[command.param] = { status: "done", result };
      console.log(`src/extension.ts:65 result`, result);
    }
    if (command && command.name === "addNewVmDriveToGuestFs") {
      await execInGuestfs("kill `pidof ack` 2>/dev/null", "worker2");
      await execInGuestfs("kill `pidof find` 2>/dev/null", "worker2");
      await execInGuestfs("/bin/unmount 2>/dev/null", "worker1");
      const result2 = await delDrives();
      console.log(`src/extension.ts:72 result2`, result2);

      await addDriveViaMonitor(`${getUserDataPath()}/user_layers/vm/${command.param}`);
      await new Promise((resolve) => setTimeout(resolve, 1 * 1000));
      const result = await execInGuestfs("/bin/guestfs", "worker1");
      mounted[command.param] = { status: "done", result };
      console.log(`src/extension.ts:79 result`, result);
    }
    if (command && command.name === "unmount") {
      console.log("Unmount all");
      await execInGuestfs("kill `pidof ack` 2>/dev/null", "worker2");
      await execInGuestfs("kill `pidof find` 2>/dev/null", "worker2");
      await execInGuestfs("/bin/unmount 2>/dev/null", "worker1");
      const result2 = await delDrives();
      console.log(`src/extension.ts:87 result2`, result2);
    }
    if (command && command.name === "getIp") {
      const resultIp = await execInGuestfs(
        `/sbin/ifconfig eth0 | grep 'inet addr' | cut -d: -f2 | awk '{printf( "%s%c", $1, 0)}'`,
        "worker1"
      );
      console.log(`src/extension.ts:94 resultIp`, resultIp);
      if (resultIp && resultIp[0].length < 7) {
        setIp(resultIp[1]);
      } else {
        setIp(resultIp[0]);
      }
    }
    loop();
  }, 1000);
})();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const userDataPath = getUserDataPath();
  console.log(`src/extension.ts:104 userDataPath`, userDataPath);
  if (!isFileExist(userDataPath)) {
    console.log(`src/extension.ts:104 CREATE`, userDataPath);
    await fsAsync.mkdir(userDataPath, {
      recursive: true,
    });
  }
  const db = require("better-sqlite3")(getUserDataPath() + "/sqlite3.db", {
    verbose: console.log,
  });
  const dataSource = new DataSource(db);
  const kymano = new Kymano(dataSource, new QemuCommands());

  const rows = await dataSource.getTables();
  if (rows === 0) {
    await dataSource.createTables();
  }
  await kymano.update();

  await runGuestFs(kymano);

  const kymanoAdapter = new KymanoAdapter(kymano, dataSource);
  const sftpService = new SFtpService("192.168.66.2");
  const vmProvider = new VirtualMachinesProvider(kymanoAdapter);
  const myVmProvider = new MyVirtualMachinesProvider(kymanoAdapter);
  const myDisksProvider = new MyDisksProvider(sftpService, kymanoAdapter);
  vscode.window.registerTreeDataProvider("my-vb-machines", myVmProvider);
  vscode.window.registerTreeDataProvider("my-disks", myDisksProvider);
  vscode.window.createTreeView("vb-machines", {
    treeDataProvider: vmProvider,
    showCollapseAll: true,
    canSelectMany: false,
  });

  // vscode.window.createTreeView("myDisks", myDisksTreeView);

  context.subscriptions.push(
    vscode.commands.registerCommand("myDisks.refresh", async (): Promise<void> => {
      console.log(`myDisks.refresh`);
      myDisksProvider.refresh();
    }),
    vscode.commands.registerCommand("myDisks.open", async (vmTreeItem?: DiskTreeItem): Promise<void> => {
      console.log(`myDisks.open`, vmTreeItem);
      myDisksProvider.open(vmTreeItem);
    }),
    vscode.commands.registerCommand("myDisks.upload", async (vmTreeItem?: DiskTreeItem): Promise<void> => {
      if (vmTreeItem) {
        vscode.window.showOpenDialog().then(async (fileInfos) => {
          console.log(`src/MyDisksProvider.ts:58 fileInfos`, fileInfos);
          if (!fileInfos) {
            return;
          }

          vmTreeItem.id = "10000";
          vmTreeItem.iconPath = new (vscode.ThemeIcon as any)("gear~spin");
          vmTreeItem.label = "loading";
          vmTreeItem.description = "importing";
          vmTreeItem.tooltip = "importing";
          vmTreeItem.command = undefined;
          myDisksProvider.refreshOneWithoutReveal(vmTreeItem);

          kymano
            .importDisk(fileInfos[0].path, path.basename(fileInfos[0].path))
            .then(() => {
              //myDisksProvider.refresh();
              //vscode.window.showInformationMessage(`Done`);
            })
            .catch((e) => {
              console.log(`src/MyDisksProvider.ts:79 path`, e);
              CantConvertDiskException(fileInfos[0].path, e.message);
            });

          await (async function loop() {
            await setTimeout(async function () {
              const qemuImgConvertingProcess = shiftQemuImgConvertingQueue();
              console.log("qemuImgConvertingProcess::::::", qemuImgConvertingProcess);

              if (qemuImgConvertingProcess && qemuImgConvertingProcess === "end") {
                console.log(`src/MyDisksProvider.ts:161 refresh`);
                myDisksProvider.refresh();
                //importing = null;
                vscode.window.showInformationMessage(`Done`);
                return;
              }
              if (qemuImgConvertingProcess) {
                console.log(`refreshOneWithoutReveal`);
                vmTreeItem.id = "10000";
                vmTreeItem.iconPath = new (vscode.ThemeIcon as any)("gear~spin");
                vmTreeItem.label = qemuImgConvertingProcess + "%";
                vmTreeItem.description = "importing";
                vmTreeItem.tooltip = "importing";
                vmTreeItem.command = undefined;
                myDisksProvider.refreshOneWithoutReveal(vmTreeItem);
              }
              await loop();
            }, 20);
          })();
          console.log(`src/extension.ts:137 vmTreeItem`, vmTreeItem);
          //vmTreeItem.label = "121";
          myDisksProvider.refreshOneWithoutReveal(vmTreeItem);
        });
      }
    }),
    vscode.commands.registerCommand("kymano-extension.click", async (vmTreeItem?: DiskTreeItem): Promise<void> => {
      //if (vmTreeItem) {
      console.log(`src/extension.ts:75 DiskTreeItem`);
      //	}
    }),
    vscode.commands.registerCommand(
      "kymano-extension.runMyVM",
      async (vmTreeItem?: VirtualMachineTreeItem): Promise<void> => {
        if (vmTreeItem) {
          const { vm } = vmTreeItem;

          (async function loop() {
            setTimeout(async function () {
              const command = shiftMessagesQueue(vm.id);
              console.log("command::::::::::::::", command);
              if (command && command.status === MessagesQueueStatus.Finished) {
                console.log(`src/extension.ts:214 return`);
                //myVmProvider.refresh(vmTreeItem);
                return;
              }

              if (command && command.status !== MessagesQueueStatus.Finished) {
                console.log(`src/extension.ts:214 command`, command);
                const newVmTreeItem = vmTreeItem;

                newVmTreeItem.iconPath = new (vscode.ThemeIcon as any)("loading~spin");
                newVmTreeItem.label = command.pct + "%";
                // downloading qemu
                // extracting qemu
                // system, ... layers + myConfigId
                // extracting system, ... layers + myConfigId
                // vmTreeItem.description = "Downloading system layer";
                newVmTreeItem.description = command.text;
                newVmTreeItem.tooltip = command.text;
                myVmProvider.refresh(newVmTreeItem);
              }
              loop();
            }, 50);
          })();

          try {
            await kymanoAdapter.startWithGui(vm.id);
            pushMessagesQueue(vm.id, { status: MessagesQueueStatus.Finished });
            vmTreeItem.label = vm.name;
            vmTreeItem.description = undefined;
            vmTreeItem.tooltip = vm.name;
            vmTreeItem.iconPath = new (vscode.ThemeIcon as any)("vm");
            myVmProvider.refresh(vmTreeItem);
            vscode.window.showInformationMessage(`My Virtual machine "${vm.name}" has been run successfully`);
          } catch (ex) {
            vscode.window.showErrorMessage(
              `Cannot run virtual machine "${vm.name}": ${ex?.message ?? "Unknown error"}`
            );
          }
        }
      }
    ),
    vscode.commands.registerCommand(
      "kymano-extension.runVM",
      async (vmTreeItem?: VirtualMachineTreeItem): Promise<void> => {
        if (vmTreeItem) {
          const { vm } = vmTreeItem;

          try {
            await kymanoAdapter.startNewWithGui(vm.id);
            vscode.window.showInformationMessage(`Virtual machine "${vm.name}" has been run successfully`);
          } catch (ex) {
            vscode.window.showErrorMessage(
              `Cannot run virtual machine "${vm.name}": ${ex?.message ?? "Unknown error"}`
            );
          }

          vmProvider.refresh();
        }
      }
    ),
    vscode.commands.registerCommand(
      "kymano-extension.runHeadlessVM",
      async (vmTreeItem?: VirtualMachineTreeItem): Promise<void> => {
        if (vmTreeItem) {
          const { vm } = vmTreeItem;
          const running = await isRunning(vm.id);

          if (!running) {
            try {
              await startWithoutGui(vm.id);
              vscode.window.showInformationMessage(`Virtual machine "${vm.name}" (Headless) has been run successfully`);
            } catch (ex) {
              vscode.window.showErrorMessage(
                `Cannot run virtual machine "${vm.name}" (Headless): ${ex?.message ?? "Unknown error"}`
              );
            }
          }
          vmProvider.refresh();
        }
      }
    ),
    vscode.commands.registerCommand(
      "kymano-extension.saveStateVM",
      async (vmTreeItem: VirtualMachineTreeItem): Promise<void> => {
        if (vmTreeItem) {
          const { vm } = vmTreeItem;

          const running = await isRunning(vm.id);
          if (running) {
            try {
              await saveState(vm.id);
              vscode.window.showInformationMessage(`Virtual machine "${vm.name}" has been stopped successfully`);
            } catch (ex) {
              vscode.window.showErrorMessage(
                `Cannot stop virtual machine "${vm.name}": ${ex?.message ?? "Unknown error"}`
              );
            }
          }
          vmProvider.refresh();
        }
      }
    ),
    vscode.commands.registerCommand(
      "kymano-extension.poweroffVm",
      async (vmTreeItem: VirtualMachineTreeItem): Promise<void> => {
        if (vmTreeItem) {
          const { vm } = vmTreeItem;

          const running = await isRunning(vm.id);
          if (running) {
            try {
              await powerOff(vm.id);
              vscode.window.showInformationMessage(`Virtual machine "${vm.name}" has been stopped successfully`);
            } catch (ex) {
              vscode.window.showErrorMessage(
                `Cannot stop virtual machine "${vm.name}": ${ex?.message ?? "Unknown error"}`
              );
            }
          }
          vmProvider.refresh();
        }
      }
    ),
    vscode.commands.registerCommand("kymano-extension.refreshVMs", (): void => {
      vmProvider.refresh();
    }),
    vscode.commands.registerCommand("kymano-extension.stopAllVms", (): void => {
      stopAllVms().then((): void => {
        vmProvider.refresh();
      });
    }),
    vscode.commands.registerCommand("kymano-extension.poweOffAllVms", (): void => {
      poweOffAllVms().then((): void => {
        vmProvider.refresh();
      });
    })
  );

  new SFtpExplorer(context);
}

export function deactivate() {
  console.log(`src/extension.ts:99 deactivate`);
  //   await Promise.all(
  //     pids.map((pid) => {
  //       // eslint-disable-next-line no-new
  //       new Promise((resolve) => {
  //         console.log("pid", pid);

  //         resolve(process.kill(pid));
  //       });
  //     })
  //   );

  console.log("pids::::::::", pids);

  pids.map((pid) => {
    // eslint-disable-next-line no-new
    console.log("pid::::::::", pid);
    process.kill(pid);
  });
  console.log("before-quit1");
}
