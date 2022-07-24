import * as vscode from "vscode";
import { ActionsForException } from "./ActionsForException";

export function CantConvertDiskException(path: string, errorMessage: string) {
  vscode.window
    .showErrorMessage(
      `Can't convert the disk, help us to improve Kymano, open an issue. Path: ${path}`,
      "Open an issue"
    )
    .then((action) => {
      ActionsForException(action, ["CantConvertDisk"], "Can not convert the disk", errorMessage);
    });
}
