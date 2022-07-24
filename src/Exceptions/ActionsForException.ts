import { getArch, getPlatform } from "kymano";
import * as vscode from "vscode";
const si = require("systeminformation");
var bytes = require("bytes");
const pjson = require("../../package.json");

const valueObject = {
  cpu: "manufacturer, brand, cores, model, virtualization",
  mem: "total, free, used",
  osInfo: "platform, distro, release, hypervisor, uefi, servicepack",
  processes: "all",
};

export async function ActionsForException(action: string, labels: [string], title: string, errorMessage: string = "") {
  const sysInfo = await si.get(valueObject);
  errorMessage = errorMessage.replaceAll(";", "");

  let qemuProcesses = sysInfo.processes.list.filter((el) => el.name.includes("qemu"));
  qemuProcesses = qemuProcesses.map((el) => {
    console.log(`src/Exceptions/ActionsForException.ts:19 qemuProcesses.map`, el);
    return { name: el.name, cpu: el.cpu, memory: el.memVsz };
  });

  if (action === "Open an issue") {
    vscode.commands.executeCommand(
      "vscode.open",
      vscode.Uri.parse(
        `https://github.com/kymano-app/vscode/issues/new?title=${title} [${vscode.version}]&body=CPU: ${
          sysInfo.cpu.manufacturer
        } ${sysInfo.cpu.brand} ${sysInfo.cpu.cores} cores ${sysInfo.cpu.model} (${Number(
          sysInfo.cpu.virtualization
        )})%0AMemory: ${bytes(sysInfo.mem.total)} total, ${bytes(sysInfo.mem.used)} used%0AOS: ${
          sysInfo.osInfo.platform
        } ${sysInfo.osInfo.distro} ${sysInfo.osInfo.release} ${
          getPlatform() === "windows" ? Number(sysInfo.osInfo.hypervisor) : ""
        } (${Number(sysInfo.osInfo.uefi)}) ${sysInfo.osInfo.servicepack}%0AVS Code v${vscode.version}, Extension v${
          pjson.version
        }%0AProcesses:%0A${qemuProcesses.map(
          (el) => `${el.name}: ${el.cpu} cpu, ${bytes(el.memory)} memory\n`
        )}%0AError: ${errorMessage}&labels=Autofilled,bug,${labels.map(
          (label) => `${label},`
        )},${getArch()},${getPlatform()},v${pjson.version}`
      )
    );
  }
}
