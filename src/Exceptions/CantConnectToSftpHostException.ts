import * as vscode from "vscode";
import { ActionsForException } from "./ActionsForException";

export function CantConnectToSftpHostException(host: string) {
  vscode.window
    .showErrorMessage(`Can't connect to ${host}, help us to improve Kymano, open an issue.`, "Open an issue")
    .then((action) => ActionsForException(String(action), ["CantConnectToSftpHost"], "Can not connect to SFTP host"));
}
