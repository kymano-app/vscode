import { DataSource, getUserDataPath, Kymano, QemuCommands } from "kymano";
import { SnippetString } from "vscode";
import { pids } from "./global";

export interface VirtualMachine {
  id: string;
  name: string;
  running: boolean;
  os: string;
}

export interface Disk {
  id: string;
  myConfigId?: number;
  diskId?: number;
  name: string;
  vmName: string;
  icon?: string;
  notCollapsed?: boolean;
  command: {};
}

export const isRunning = false;
export const saveState = false;
export const powerOff = false;

const db = require("better-sqlite3")(getUserDataPath() + "/sqlite3.db", {
  verbose: console.log,
});
const dataSource = new DataSource(db);
const kymano = new Kymano(dataSource, new QemuCommands());

export function getAllVms(): Promise<VirtualMachine[]> {
  return new Promise(async (resolve, reject) => {
    // const rows = await dataSource.getTables();
    // if (rows === 0) {
    //   await dataSource.createTables();
    // }
    // await kymano.update();

    // runGuestFs(kymano);

    const configs = await kymano.configListForIde();

    let vms = configs.map((cfg) => ({ id: cfg.config_id, name: cfg.name }));
    console.log(`src/utils.ts:33 configs`, configs, vms);

    resolve(vms);
  });
}

export function getMyVms(): Promise<VirtualMachine[]> {
  return new Promise(async (resolve, reject) => {
    const myvms = await kymano.getMyVmsWithoutInternals();

    let vms = myvms.map((cfg) => ({ id: cfg.my_vm_id, name: cfg.vm_name }));
    console.log(`src/utils.ts:33 configs`, vms);

    //let vms = [{ id: "1", name: "111111" }];
    resolve(vms);
  });
}

export function getMyDisks(): Promise<VirtualMachine[]> {
  return new Promise(async (resolve, reject) => {
    const disks0 = await dataSource.getMyDisks();
    const vmDisks0 = await dataSource.getMyVmDisks();
    const disks = [];
    if (disks0) {
      disks0.forEach((vmDisks) => {
        disks.push({
          id: `disk${vmDisks.id}`,
          diskId: `${vmDisks.id}`,
          name: `${vmDisks.name}`,
          vmName: `disk`,
        });
      });
    }
    if (vmDisks0) {
      vmDisks0.forEach((vmDisks) => {
        const disksParsed = JSON.parse(vmDisks.disks);
        let i = 0;
        disksParsed.forEach((singleDisk) => {
          i++;
          disks.push({
            id: `vmdisk${vmDisks.id}-${i}`,
            myConfigId: `${vmDisks.id}`,
            name: `${singleDisk}`,
            vmName: `${vmDisks.vm_name}`,
          });
        });
      });
    }

    console.log(`disks`, disks);

    resolve(disks);
  });
}

export function startWithGui(myConfigId: string): Promise<void> {
  return new Promise(async (resolve, reject): Promise<void> => {
    const response = await kymano.runVm(myConfigId);
    pids.push(response[0].child.pid);

    resolve();
  });
}

export function startNewWithGui(vmId: string): Promise<void> {
  return new Promise(async (resolve, reject): Promise<void> => {
    const myConfigId = await kymano.createVm(Number(vmId));
    const response = await kymano.runVm(myConfigId);
    console.log(`src/utils.ts:79 response`, response);
    pids.push(response[0].child.pid);

    resolve();
  });
}

/**
 * Stops all virtual machines with saving states
 */
export async function stopAllVms(): Promise<void[]> {
  const vms = await getAllVms();
  const runningVmIds = vms.filter((vm) => vm.running).map((vm) => vm.id);
  const promises = runningVmIds.map((id) => saveState(id));
  return await Promise.all(promises);
}

/**
 * Power off all virtual machines without saving states
 */
export async function poweOffAllVms(): Promise<void[]> {
  const vms = await getAllVms();
  const runningVmIds = vms.filter((vm) => vm.running).map((vm) => vm.id);
  const promises = runningVmIds.map((id) => powerOff(id));
  return await Promise.all(promises);
}

// export async function getOsName(vmId: string): Promise<string> {
//     return new Promise((resolve) => {
//         virtualbox.guestproperty.get({ vmname: vmId, key: "ostype" }, (value) => {
//             resolve(value);
//         });
//     });
// }
