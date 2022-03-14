import * as MonoUtils from "@fermuch/monoutils";
import wellknown from 'wellknown';
import geoPointInPolygon from 'geo-point-in-polygon';
import { CollectionDoc } from "@fermuch/telematree";

type GeofenceConfig = {
  name: string;
  kind: 'default' | 'speedLimit';
  wkt: string;
  speedLimit?: number;
}

// based on settingsSchema @ package.json
type Config = {
  saveGPS: boolean;
  enableGeofences: boolean;
  geofences: GeofenceConfig[];
};
const conf = new MonoUtils.config.Config<Config>();

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

class GenericEvent<T> extends MonoUtils.wk.event.BaseEvent {
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

class GeofenceEvent extends MonoUtils.wk.event.BaseEvent {
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

messages.on('onInit', function () {
  platform.log('GPS script started');

  env.setData('GPS_REQUESTED', true);
  // NOTE: some versions of the monoflow app need to have the GPS_REQUESTED downcased...
  env.setData('gps_requested', true);

  // config for GPS requests
  env.setData('GPS_TIMEOUT', 1000 * 120);
  env.setData('GPS_MAXIMUM_AGE', 1000 * 120);
  env.setData('GPS_HIGH_ACCURACY', true);
  env.setData('GPS_DISTANCE_FILTER', 5);
  env.setData('GPS_USE_SIGNIFICANT_CHANGES', true);
});

type GeofenceCol = {
  insideSince: number | null;
  [geofenceName: string]: number | null;
}

function getCol(): CollectionDoc<GeofenceCol> | undefined {
  const col = env.project?.collectionsManager.ensureExists<GeofenceCol>('geofence', 'Geofence');
  return col.get(MonoUtils.myID());
}

MonoUtils.wk.event.subscribe<GPSSensorEvent>('sensor-gps', (ev) => {
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

    env.project?.saveEvent(event);
  }

  if (!conf.get('enableGeofences', false)) {
    return;
  }

  // check geofences
  const geofences = conf.get('geofences', []);
  const lat = ev.getData().latitude;
  const lon = ev.getData().longitude;
  const speed = ev.getData().speed * 3.6;
  
  for (const geofence of geofences) {
    let geojson;
    try {
      geojson = wellknown.parse(geofence.wkt);
    } catch (e) {
      platform.log(`Error while checking geofence ${geofence.name}: ${e.message}`);
      continue;
    }

    const wasInside: number | null = getCol()?.data[geofence.name] || null;
    const isInside = geoPointInPolygon([lon, lat], geojson) as boolean;

    platform.log({wasInside, isInside, name: geofence.name});

    if (isInside && !wasInside) {
      platform.log(`${geofence.name} is now inside`);
      getCol()?.set(geofence.name, Date.now());
      env.project?.saveEvent(new GeofenceEvent(geofence.name, true, ev.getData(), null));
    } else if (!isInside && wasInside) {
      platform.log(`${geofence.name} is now outside`);
      getCol()?.set(geofence.name, null);
      env.project?.saveEvent(new GeofenceEvent(geofence.name, false, ev.getData(), wasInside));
    }

    if (geofence.kind === 'speedLimit') {
      if (speed > geofence.speedLimit) {
        platform.log(`Speed limit reached: ${geofence.speedLimit}`);
        env.project?.saveEvent(new SpeedExcessEvent(geofence.name, ev.getData(), geofence.speedLimit));
      }
    }
  }
});