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
  loading?: any;
  id: string;
  myConfigId?: number;
  extension?: string;
  diskId?: number;
  name: string;
  vmName: string;
  icon?: string;
  notCollapsed?: boolean;
  command?: {};
}

export const isRunning = false;
export const saveState = false;
export const powerOff = false;

export class KymanoAdapter {
  constructor(private readonly kymano: Kymano, private readonly dataSource: DataSource) {}

  public getAllVms = (): Promise<VirtualMachine[]> => {
    return new Promise(async (resolve, reject) => {
      // const rows = await this.dataSource.getTables();
      // if (rows === 0) {
      //   await this.dataSource.createTables();
      // }
      // await this.kymano.update();

      // runGuestFs(kymano);

      const configs = await this.kymano.configListForIde();

      let vms = configs.map((cfg) => ({ id: cfg.config_id, name: cfg.name }));
      console.log(`src/utils.ts:33 configs`, configs, vms);

      resolve(vms);
    });
  };

  public getMyVms = (): Promise<VirtualMachine[]> => {
    return new Promise(async (resolve, reject) => {
      const myvms = await this.kymano.getMyVmsWithoutInternals();

      let vms = myvms.map((cfg) => ({ id: cfg.my_vm_id, name: cfg.vm_name }));
      console.log(`src/utils.ts:33 configs`, vms);

      //let vms = [{ id: "1", name: "111111" }];
      resolve(vms);
    });
  };

  public getMyDisks = (): Promise<VirtualMachine[]> => {
    return new Promise(async (resolve, reject) => {
      const disks0 = await this.dataSource.getMyDisks();
      const vmDisks0 = await this.dataSource.getMyVmDisks();
      const disks = [];
      if (disks0) {
        disks0.forEach((vmDisks) => {
          disks.push({
            id: `disk${vmDisks.id}`,
            diskId: `${vmDisks.id}`,
            name: `${vmDisks.name}`,
            extension: `${vmDisks.extension}`,
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
  };

  public startWithGui = (myConfigId: string): Promise<void> => {
    return new Promise(async (resolve, reject): Promise<void> => {
      console.log(`src/kymanoAdapter.ts:102 startWithGui`);
      const response = await this.kymano.runVm(myConfigId);
      pids.push(response[0].child.pid);

      resolve();
    });
  };

  public startNewWithGui = (vmId: string): Promise<void> => {
    return new Promise(async (resolve, reject): Promise<void> => {
      const myConfigId = await this.kymano.createVm(Number(vmId));
      const response = await this.kymano.runVm(myConfigId);
      console.log(`src/utils.ts:79 response`, response);
      pids.push(response[0].child.pid);

      resolve();
    });
  };

  /**
   * Stops all virtual machines with saving states
   */
  public stopAllVms = async (): Promise<void[]> => {
    const vms = await this.getAllVms();
    const runningVmIds = vms.filter((vm) => vm.running).map((vm) => vm.id);
    const promises = runningVmIds.map((id) => this.saveState(id));
    return await Promise.all(promises);
  };

  /**
   * Power off all virtual machines without saving states
   */
  public poweOffAllVms = async (): Promise<void[]> => {
    const vms = await this.getAllVms();
    const runningVmIds = vms.filter((vm) => vm.running).map((vm) => vm.id);
    const promises = runningVmIds.map((id) => this.powerOff(id));
    return await Promise.all(promises);
  };

  // export async function getOsName(vmId: string): Promise<string> {
  //     return new Promise((resolve) => {
  //         virtualbox.guestproperty.get({ vmname: vmId, key: "ostype" }, (value) => {
  //             resolve(value);
  //         });
  //     });
  // }
}
