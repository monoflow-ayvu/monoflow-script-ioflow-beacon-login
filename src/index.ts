import * as MonoUtils from "@fermuch/monoutils";
import wellknown, { GeoJSONGeometry } from 'wellknown';
import geoPointInPolygon from 'geo-point-in-polygon';
import { CollectionDoc } from "@fermuch/telematree";
import { currentLogin, myID } from "@fermuch/monoutils";
import { getUrgentNotification, setUrgentNotification } from "./utils";

export type ImpossibleConfig = {
  tags: string[];
  maxSpeed: number;
}

export type GeofenceConfig = {
  name: string;
  kind: 'default' | 'speedLimit' | 'openForm' | 'openTask' | 'showForm';
  wkt: string;
  speedLimit?: number;
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
  overspeedActivityFilter: boolean;

  highAccuracy: boolean;
  omitNotGPS: boolean;
  schedule: {day: string[]; startTime: string; endTime: string}[];
  warnUserOverspeed: boolean;
  autoDisableOverSpeedAlert: boolean;
  showOkButtonForAlert: boolean;

  impossible: ImpossibleConfig[];
};
const conf = new MonoUtils.config.Config<Config>();

const ACTION_OK_OVERSPEED = 'gps-overspeed:ok' as const;

declare class GPSSensorEvent extends MonoUtils.wk.event.BaseEvent {
  kind: "sensor-gps";
  getData(): {
    latitude: number;
    longitude: number;
    altitude: number;
    accuracy: number;
    altitudeAccuracy: number;
    heading: number;
    speed: number;
  };
}

export class GenericEvent<T> extends MonoUtils.wk.event.BaseEvent {
  kind = "generic";
  type: string;
  payload: T;
  metadata: { [key: string]: string | number | boolean };

  constructor(type: string, data: T, metadata: { [key: string]: string | number | boolean } = {}) {
    super();
    this.type = type;
    this.payload = data;
    this.metadata = metadata;
  }

  getData(): {
    type: string;
    metadata: {
      [key: string]: string | number | boolean;
    };
    payload: T;
  } {
    return {
      type: this.type,
      metadata: this.metadata,
      payload: this.payload,
    };
  }
}

export class GeofenceEvent extends MonoUtils.wk.event.BaseEvent {
  kind = 'geofence' as const;
  private name: string;
  private entering: boolean;
  private since: number | null = null;
  private position: {
    latitude: number;
    longitude: number;
    altitude: number;
    accuracy: number;
    altitudeAccuracy: number;
    heading: number;
    speed: number;
  }

  constructor(
    name: string,
    entering: boolean,
    position: {
      latitude: number;
      longitude: number;
      altitude: number;
      accuracy: number;
      altitudeAccuracy: number;
      heading: number;
      speed: number;
    },
    since: number | null,
  ) {
    super();
    this.name = name;
    this.entering = entering;
    this.position = position;
    this.since = since;
  }

  getData(): unknown {
    return {
      name: this.name,
      when: Date.now(),
      deviceId: MonoUtils.myID(),
      login: MonoUtils.currentLogin(),
      since: this.since,
      totalSecondsInside: this.since ? Math.floor((Date.now() - this.since) / 1000) : null,
      entering: this.entering,
      exiting: !this.entering,
      position: this.position
    }
  }
}

class SpeedExcessEvent extends MonoUtils.wk.event.BaseEvent {
  kind = 'speed-excess' as const;
  private gpsData: ReturnType<GPSSensorEvent['getData']>;
  private name: string;
  private speedLimit: number;

  constructor(name: string, ev: ReturnType<GPSSensorEvent['getData']>, speedLimit: number) {
    super();
    this.name = name;
    this.gpsData = ev;
    this.speedLimit = speedLimit;
  }

  getData() {
    return {
      deviceId: MonoUtils.myID(),
      login: MonoUtils.currentLogin(),
      when: Date.now(),
      gps: this.gpsData,
      speedLimit: this.speedLimit,
      name: this.name,
    }
  }
}

const originalFormStates: {[id: string]: {
  show: boolean;
}} = {};

function anyTagMatches(tags: string[]): boolean {
  // we always match if there are no tags
  if (!tags || tags.length === 0) return true;

  const userTags = env.project?.logins?.find((login) => login.key === currentLogin())?.tags || [];
  const deviceTags = env.project?.usersManager?.users?.find?.((u) => u.$modelId === myID())?.tags || [];
  const allTags = [...userTags, ...deviceTags];

  return tags.some((t) => allTags.includes(t));
}

function tryOpenTaskOrForm(geofence: GeofenceConfig, isOnEnter: boolean) {
  if (geofence.kind !== 'openForm' && geofence.kind !== 'openTask') {
    return;
  }

  if (!currentLogin()) {
    return;
  }

  if (env.data.CURRENT_PAGE === 'Submit') {
    return;
  }

  if (isOnEnter && !geofence.when.onEnter) {
    return;
  }

  if (!isOnEnter && !geofence.when.onExit) {
    return;
  }

  if (!('goToSubmit' in platform)) {
    platform.log('no goToSubmit platform tool available');
    return;
  }

  platform.log(`showing ${geofence.kind === 'openForm' ? 'form' : 'task'}: ${geofence.id}`);
  (platform as unknown as { gotToSubmit: (formId?: string, taskId?: string) => void })?.gotToSubmit?.(
    geofence.kind === 'openForm' ? geofence.id : '',
    geofence.kind === 'openTask' ? geofence.id : ''
  );
}

function ensureForm(formId: string, show: boolean) {
  if (!formId) return;
  const form = env.project?.formsManager?.forms?.find((page) => page.$modelId === formId)
  if (!form) return;

  const changes = {};

  if (form.show !== show) {
    changes['show'] = show;
  }

  if (form.autonomous !== show) {
    changes['autonomous'] = show;
  }

  if (Object.keys(changes).length > 0) {
    form._setRaw(changes);
  }
}

function restoreforms() {
  Object.keys(originalFormStates).forEach((pId) => {
    const p = originalFormStates[pId];
    ensureForm(pId, p.show);
  });
}

messages.on('onInit', function () {
  platform.log('GPS script started');

  env.project?.formsManager?.forms.forEach((form) => {
    originalFormStates[form.$modelId] = {
      show: form.show,
    }
  });

  // config for GPS requests
  env.setData('GPS_TIMEOUT', 1000 * 120);
  env.setData('GPS_MAXIMUM_AGE', 1000 * 120);
  env.setData('GPS_HIGH_ACCURACY', conf.get('highAccuracy', true));
  env.setData('GPS_DISTANCE_FILTER', 5);
  env.setData('GPS_USE_SIGNIFICANT_CHANGES', true);

  // set schedule if it exists
  if (conf.get('schedule', []).length > 0) {
    const schedule = conf.get('schedule', []).reduce((acc, sch) => {
      acc.push(
        `${sch.day.join(',')} ${sch.startTime}-${sch.endTime}`
      )
      return acc;
    }, [] as string[])
    env.setData('GPS_SCHEDULE', schedule);
  } else {
    env.setData('GPS_SCHEDULE', undefined);
  }

  // request GPS activation
  env.setData('GPS_REQUESTED', true);
  // NOTE: some versions of the monoflow app need to have the GPS_REQUESTED downcased...
  env.setData('gps_requested', true);
});

// on exit restore original form states
messages.on('onEnd', () => {
  restoreforms();
});

// on logout restore original form states
messages.on('onLogout', () => {
  restoreforms();
})

type GeofenceCol = {
  insideSince: number | null;
  [geofenceName: string]: number | null;
}

function getCol(): CollectionDoc<GeofenceCol> | undefined {
  const col = env.project?.collectionsManager.ensureExists<GeofenceCol>('geofence', 'Geofence');
  return col.get(MonoUtils.myID());
}

function onSpeedExcess(ev: GPSSensorEvent, geofence?: GeofenceConfig) {
  if (conf.get('overspeedActivityFilter', true)) {
    let currentAct: {name?: string} = env.data.CURRENT_ACTIVITY || {};
    if (typeof currentAct === 'string') {
      try {
        currentAct = JSON.parse(currentAct);
      } catch {
        // pass
      }
    }

    if (currentAct?.name === 'STILL') {
      platform.log('speed limit omitted since currenct activity is STILL');
      return;
    }
  }

  const speed = (ev?.gps?.speed || 0) * 3.6;
  const speedLimit = geofence?.speedLimit || conf.get('speedLimit', 0) || 0;
  platform.log(`Speed limit reached: ${speed} km/h (limit: ${speedLimit} km/h)`);
  env.project?.saveEvent(
    new SpeedExcessEvent(
      geofence?.name || 'default',
      ev.getData(),
      speedLimit
    )
  );

  if (conf.get('warnUserOverspeed', false)) {
    let buttons = [];
    if (conf.get('showOkButtonForAlert', true)) {
      buttons.push({
        action: ACTION_OK_OVERSPEED,
        name: 'OK',
        payload: {},
      })
    }

    setUrgentNotification({
      title: 'Límite de velocidade',
      color: '#d4c224',
      message: 'Foi detectado um excesso de velocidade',
      urgent: true,
      actions: buttons,
    })
  }
}

function clearAlert() {
  if (conf.get('autoDisableOverSpeedAlert', true) === false) {
    return;
  }

  const notif = getUrgentNotification();
  if (!notif) return;

  const isOverspeed = notif.actions?.some((n) => n.action === ACTION_OK_OVERSPEED);
  if (isOverspeed) {
    setUrgentNotification(null);
  }
}

MonoUtils.wk.event.subscribe<GPSSensorEvent>('sensor-gps', (ev) => {
  if (conf.get('omitNotGPS', false) === true) {
    if (ev.getData().speed === -1) {
      return;
    }
  }

  const speed = ev.getData().speed * 3.6;
  const lat = ev.getData().latitude;
  const lon = ev.getData().longitude;

  const impossibleRules = conf.get('impossible', []);
  for (const impRule of impossibleRules) {
    platform.log('evaluating rule', impRule);
    // for now we only check for speed, so if no speed is giving we ignore the rule
    if (impRule.maxSpeed === 0) continue;

    // check for global rules
    if ((impRule.tags || []).length === 0 && speed > impRule.maxSpeed) {
      return; // cancel this event
    }

    // tagged rules
    if (anyTagMatches(impRule.tags) && speed > impRule.maxSpeed) {
      return; // cancel this event
    }
  }

  // Store GPS
  if (conf.get('saveGPS', false)) {
    // this event is re-built like this to keep backwards compatibility
    const event = MonoUtils.wk.event.regenerateEvent(new GenericEvent('custom-gps', {
      ...ev.getData(),
      // speeds is deprecated, but we still want to support it
      speeds: [] as number[],
    }, {
      deviceId: MonoUtils.myID(),
      login: MonoUtils.currentLogin() || false,
    }));

    const saveEvery = conf.get('saveEveryMins', 0);
    const lastGpsUpdate = Number(env.data.LAST_GPS_UPDATE || '0') || 0;
    if (saveEvery === 0 || (Date.now() - lastGpsUpdate) > saveEvery * 60 * 1000) {
      env.setData('LAST_GPS_UPDATE', Date.now());
      env.project?.saveEvent(event);
    }
  }

  let hadSpeedExcess = false;
  const speedLimit = conf.get('speedLimit', 0);
  if (speedLimit > 0) {
    if (speed > speedLimit) {
      onSpeedExcess(ev);
      hadSpeedExcess = true;
    }
  }

  if (!conf.get('enableGeofences', false)) {
    if (!hadSpeedExcess) {
      clearAlert();
    }
    return;
  }

  // check geofences
  const geofences = conf.get('geofences', []);
  
  for (const geofence of geofences) {
    let geojson: GeoJSONGeometry | undefined;
    try {
      geojson = wellknown.parse(geofence.wkt);
    } catch (e) {
      platform.log(`Error while checking geofence ${geofence.name}: ${e.message}`);
      continue;
    }

    if (geojson.type !== 'Polygon') {
      platform.log(`Geofence ${geofence.name} is not a polygon`);
      continue;
    }

    const matchesOurDevice = anyTagMatches(geofence.tags || []);
    if (!matchesOurDevice) {
      continue;
    }

    const wasInside: number | null = getCol()?.data[geofence.name] || null;
    const isInside = geoPointInPolygon([lon, lat], geojson.coordinates[0]) as boolean;

    if (isInside && !wasInside) {
      platform.log(`${geofence.name} is now inside`);
      getCol()?.set(geofence.name, Date.now());
      env.project?.saveEvent(new GeofenceEvent(geofence.name, true, ev.getData(), null));
      tryOpenTaskOrForm(geofence, true);
    } else if (!isInside && wasInside) {
      platform.log(`${geofence.name} is now outside`);
      getCol()?.set(geofence.name, null);
      env.project?.saveEvent(new GeofenceEvent(geofence.name, false, ev.getData(), wasInside));
      tryOpenTaskOrForm(geofence, false);
    }

    if (isInside && geofence.kind === 'speedLimit') {
      if (speed > geofence.speedLimit) {
        hadSpeedExcess = true;
        onSpeedExcess(ev, geofence);
      }
    }

    if (geofence.kind === 'showForm') {
      ensureForm(geofence.id, isInside); 
    }
  }

  if (!hadSpeedExcess) {
    clearAlert();
  }
});

messages.on('onCall', (actId, _payload) => {
  if (actId !== ACTION_OK_OVERSPEED) {
    return;
  }

  setUrgentNotification(null);
})