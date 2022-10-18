import * as MonoUtils from "@fermuch/monoutils";

export type ImpossibleConfig = {
  tags: string[];
  maxSpeed: number;
}

export type GeofenceConfig = {
  name: string;
  kind: 'default' | 'speedLimit' | 'openForm' | 'openTask' | 'showForm';
  wkt: string;
  speedLimit?: number;
  speedPreLimit?: number;
  tags?: string[];
  id?: string;
  when?: {onEnter: boolean; onExit: boolean};
}

// based on settingsSchema @ package.json
export type Config = {
  saveGPS: boolean;
  saveEveryMins: number;
  enableGeofences: boolean;
  geofences: GeofenceConfig[];
  speedLimit: number;
  speedPreLimit: number;
  overspeedActivityFilter: boolean;

  highAccuracy: boolean;
  maxAccuracy: number;
  omitNotGPS: boolean;
  schedule: {day: string[]; startTime: string; endTime: string}[];
  warnUserOverspeed: boolean;
  autoDisableOverSpeedAlert: boolean;
  showOkButtonForAlert: boolean;

  impossible: ImpossibleConfig[];
};

export const conf = new MonoUtils.config.Config<Config>();