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

function getMacForLoginId(loginId: string | null): string | null {
  if (!loginId) {
    return null
  }

  return conf.get('beacons', []).find((b) => b.login === loginId)?.mac || null;
}

function setLoginFor(loginId: string | null) {
  const mac = getMacForLoginId(loginId);
  platform.log(`setLoginFor loginId="${loginId}" mac="${mac}"`);
  env.setData('MONOFLOW_MAC_LOGIN', mac);
};
