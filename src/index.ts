import { currentLogin } from "@fermuch/monoutils";
import { conf } from "./config";

messages.on('onInit', () => {
  setLoginFor(currentLogin() || null)
});

messages.on('onLogin', (loginId) => {
  setLoginFor(loginId || currentLogin())
});

messages.on('onLogout', () => {
  setLoginFor(null);
});

let synced = false;
let toSync: string | null = null;
let rpcSent = 0;

function getMacForLoginId(loginId: string | null): string | null {
  if (!loginId) {
    return null
  }

  return conf.get('beacons', []).find((b) => b.login === loginId)?.mac || null;
}

function setLoginFor(loginId: string | null) {
  const mac = getMacForLoginId(loginId);
  platform.log(`setLoginFor loginId="${loginId}" mac="${mac}"`);
  if (toSync !== mac) {
    toSync = mac;
    synced = false;
    rpcSent = 0;
  }
};

messages.on('onPeriodic', () => {
  if (synced === true) {
    return
  }

  // 10 seconds between sync tries
  if ((Date.now() - rpcSent) / 1000 < 10) {
    return;
  }

  if (!('bleRequest' in platform)) {
    platform.log('bleRequest not available!!');
    return
  }
  
  const bleRequest = (platform as unknown as {
    bleRequest: (command: string, payload: unknown) => Promise<unknown>
  }).bleRequest;
  let prom: Promise<unknown>;
  if (toSync) {
    platform.log(`Syncing login ${toSync}`);
    prom = bleRequest('Login', {mac: toSync});
  } else {
    platform.log('Syncing logout');
    prom = bleRequest('Logout', null);
  }
  const localToSync = toSync;
  rpcSent = Date.now();
  prom
    .then((_payload) => {
      if (toSync === localToSync) {
        synced = true;
      }
    })
    .catch((e) => {
      platform.log('error syncing', e);
    })
});
