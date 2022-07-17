import { Kymano, getArch, getUserDataPath } from "kymano";

import { pids } from "./global";

const fsNormal = require("fs");

export async function runGuestFs(kymano: Kymano): Promise<number | null> {
  try {
    const myConfig = await kymano.getMyConfigById(1);
    console.log(`runGuestFs`);
    if (!myConfig) {
      await kymano.createVm(getArch() === "arm64" ? 1 : 2);
      console.log(`src/main/services.ts:114 kymano.runVm`);
      const response = await kymano.runVm(1);
      console.log(`src/main/services.ts:114 response`, response);
      pids.push(response[0].child.pid);
    } else {
      console.log(`src/main/services.ts:114 kymano.runVm`);
      const response = await kymano.runVm(1);
      console.log(`src/main/services.ts:114 kymano.runVm`);
      console.log(`src/main/services.ts:114 kymano.runVm`, response[0].child.pid);
      pids.push(response[0].child.pid);
    }
    console.log(`src/services.ts:19 pids0:::::`,pids);
    // const response = await kymano.run('guestfs', []);
    // const { pid } = response[0].child;
    // fsNormal.writeFileSync(
    //   path.join(app.getPath('userData'), 'guestfs.pid'),
    //   pid.toString()
    // );
    // return pid;
  } catch (e) {
    fsNormal.writeFileSync(`${getUserDataPath()}/error.log`, e.message);
  }

  return null;
}
