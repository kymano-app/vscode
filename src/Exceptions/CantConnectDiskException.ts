import * as vscode from "vscode";
import { DiskTreeItem } from "../diskTreeitem";
import { ActionsForException } from "./ActionsForException";

export function CantConnectDiskException(errorMessage: string, disk: DiskTreeItem) {
  errorMessage = errorMessage + "\nDisk name: " + disk.name;

  vscode.window
    .showErrorMessage(`Can't connect a disk, help us to improve Kymano, open an issue.`, "Open an issue")
    .then((action) => {
      ActionsForException(
        action,
        [`CantConnectDisk`, disk.extension],
        `Can not connect a disk ${disk.extension}`,
        errorMessage
      );
    });
}
