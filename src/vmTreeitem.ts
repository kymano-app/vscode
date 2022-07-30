import * as vscode from 'vscode';
import { VirtualMachine } from './kymanoAdapter';

export class VirtualMachineTreeItem extends vscode.TreeItem {
    constructor(public readonly vm: VirtualMachine) {
        super(vm.name);

        this.id = vm.id;
        this.iconPath = new (vscode.ThemeIcon as any)(vm.running ? "vm-running" : "vm");
        this.contextValue = vm.running ? "vmRunning" : "vmStopped";
    }
}
