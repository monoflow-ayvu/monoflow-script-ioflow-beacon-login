import { currentLogin } from "@fermuch/monoutils";
import { conf } from "./config";

messages.on('onInit', () => {
  setLoginFor(currentLogin() || null)
});

messages.on('onLogin', (loginId) => {
  setLoginFor(loginId)
});

messages.on('onLogin', () => {
  setLoginFor(null);
});

let synced = false;
let toSync: string | null = null;

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
  }
};

messages.on('onPeriodic', () => {
  platform.log('onPeriodic!');

  if (synced === true) {
    return
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
  prom
    .then((payload) => {
      platform.log('synced!!', payload);
    })
    .catch((e) => {
      platform.log('error syncing', e);
    })
});
