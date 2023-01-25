import * as MonoUtils from "@fermuch/monoutils";

export type BeaconData = {
  login: string;
  mac: string;
}

// based on settingsSchema @ package.json
export type Config = {
  beacons: BeaconData[];
};

export const conf = new MonoUtils.config.Config<Config>();