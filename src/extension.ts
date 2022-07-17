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
} from "kymano";
import { mounted } from "kymano/dist/global";
import * as vscode from "vscode";
import { DiskTreeItem } from "./diskTreeitem";
import { pids } from "./global";
import { MyDisksProvider } from "./MyDisksProvider";
import { runGuestFs } from "./services";
import { SFtpExplorer } from "./sftpExplorer";
import { SFtpService } from "./SFtpService";
import {
  isRunning,
  poweOffAllVms,
  powerOff,
  saveState,
  startNewWithGui,
  startWithGui,
  startWithoutGui,
  stopAllVms,
} from "./utils";
import { MyVirtualMachinesProvider, VirtualMachinesProvider } from "./vmsProvider";
import { VirtualMachineTreeItem } from "./vmTreeitem";

const db = require("better-sqlite3")(getUserDataPath() + "/sqlite3.db", {
  verbose: console.log,
});
const dataSource = new DataSource(db);
const kymano = new Kymano(dataSource, new QemuCommands());

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
      console.log("result::::::", result2);
      
      await addDriveViaMonitor(`${getUserDataPath()}/user_layers/disk/${command.param}`);
      await new Promise((resolve) => setTimeout(resolve, 1 * 1000));
      const result = await execInGuestfs("/bin/guestfs", "worker1");
      mounted[command.param] = "done";
      console.log("result::::::", result);
    }
    if (command && command.name === "addNewVmDriveToGuestFs") {
      await execInGuestfs("kill `pidof ack` 2>/dev/null", "worker2");
      await execInGuestfs("kill `pidof find` 2>/dev/null", "worker2");
      await execInGuestfs("/bin/unmount 2>/dev/null", "worker1");
      const result2 = await delDrives();
      console.log("result::::::", result2);

      await addDriveViaMonitor(`${getUserDataPath()}/user_layers/vm/${command.param}`);
      await new Promise((resolve) => setTimeout(resolve, 1 * 1000));
      const result = await execInGuestfs("/bin/guestfs", "worker1");
      mounted[command.param] = "done";
      console.log("result::::::", result);
    }
    if (command && command.name === "unmount") {
      console.log("Unmount all");
      await execInGuestfs("kill `pidof ack` 2>/dev/null", "worker2");
      await execInGuestfs("kill `pidof find` 2>/dev/null", "worker2");
      await execInGuestfs("/bin/unmount 2>/dev/null", "worker1");
      const result2 = await delDrives();
      console.log("result2:::::", result2);
    }
    if (command && command.name === "getIp") {
      const resultIp = await execInGuestfs(
        `/sbin/ifconfig eth0 | grep 'inet addr' | cut -d: -f2 | awk '{printf( "%s%c", $1, 0)}'`,
        "worker1"
      );
      console.log("resultIp::::::", resultIp);
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
  const rows = await dataSource.getTables();
  if (rows === 0) {
    await dataSource.createTables();
  }
  await kymano.update();

  await runGuestFs(kymano);

  const sftpService = new SFtpService("192.168.66.2");
  const vmProvider = new VirtualMachinesProvider();
  const myVmProvider = new MyVirtualMachinesProvider();
  const myDisksProvider = new MyDisksProvider(sftpService);
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
    vscode.commands.registerCommand("myDisks.upload", async (): Promise<void> => {
      console.log(`myDisks.upload`);
      myDisksProvider.upload();
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
          (async function loop() {
            setTimeout(async function () {
              const command = shiftMessagesQueue();
              console.log("command::::::", command);
              if (command) {
                vmTreeItem.iconPath = new (vscode.ThemeIcon as any)("loading~spin");
                vmTreeItem.label = command + "%";
                vmTreeItem.description = "Downloading system layer";
                vmTreeItem.tooltip = "Downloading system layer";
                myVmProvider.refresh(vmTreeItem);
              }
              loop();
            }, 100);
          })();

          const { vm } = vmTreeItem;
          try {
            await startWithGui(vm.id);
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
            await startNewWithGui(vm.id);
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
