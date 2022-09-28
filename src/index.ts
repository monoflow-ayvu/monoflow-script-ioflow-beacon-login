import * as MonoUtils from "@fermuch/monoutils";
import { CollectionDoc } from "@fermuch/telematree";
import { currentLogin, myID } from "@fermuch/monoutils";
import { getUrgentNotification, setUrgentNotification } from "./utils";
import { GPSSensorEvent, SpeedExcessEvent, GenericEvent, GeofenceEvent } from "./events";
import { conf, GeofenceConfig } from "./config";
import { ACTION_OK_OVERSPEED } from "./constants";
import { geofence$, overSpeed$ } from "./pipelines";
import { onOverspeed } from "./overspeed";
import { ensureForm } from "./forms_and_tasks";
import { geofenceCache } from "./pipelines/utils/geofence_cache";
import { onPosition } from "./position";
// import { of, map } from "rxjs";

const originalFormStates: {[id: string]: {
  show: boolean;
}} = {};

function restoreforms() {
  Object.keys(originalFormStates).forEach((pId) => {
    const p = originalFormStates[pId];
    ensureForm(pId, p.show);
  });
}

messages.on('onInit', () => {
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

  // pre cache all geofences
  if (conf.get('enableGeofences', false)) {
    for (const geofence of conf.get('geofences', [])) {
      geofenceCache.save(geofence.name, geofence.wkt);
    }
  }
});

// on exit restore original form states
messages.on('onEnd', () => {
  restoreforms();
});

// on logout restore original form states
messages.on('onLogout', () => {
  restoreforms();
});

messages.on('onCall', (actId, _payload) => {
  if (actId !== ACTION_OK_OVERSPEED) {
    return;
  }

  setUrgentNotification(null);
});

overSpeed$.subscribe(onOverspeed);
geofence$.subscribe(onPosition);
// TODO: clearAlert() periodically





// let lastGpsSensorRead = 0;
// MonoUtils.wk.event.subscribe<GPSSensorEvent>('sensor-gps', (ev) => {
//   const data = ev.getData();
//   if (conf.get('omitNotGPS', false) === true) {
//     if (
//       // these settings are only provided by the GPS sensor
//          data.speed === -1
//       || data.altitude === -1
//       || data.heading === -1
//       || data.accuracy === -1
//     ) {
//       return;
//     }
//   }

//   const maxAccuracy = conf.get('maxAccuracy', 0);
//   if (maxAccuracy > 0 && data.accuracy > maxAccuracy) {
//     return;
//   }

//   const speed = data.speed * 3.6;
//   const lat = data.latitude;
//   const lon = data.longitude;

//   const impossibleRules = conf.get('impossible', []);
//   for (const impRule of impossibleRules) {
//     platform.log('evaluating rule', impRule);
//     // for now we only check for speed, so if no speed is giving we ignore the rule
//     if (impRule.maxSpeed === 0) continue;

//     // check for global rules
//     if ((impRule.tags || []).length === 0 && speed > impRule.maxSpeed) {
//       return; // cancel this event
//     }

//     // tagged rules
//     if (anyTagMatches(impRule.tags) && speed > impRule.maxSpeed) {
//       return; // cancel this event
//     }
//   }

//   // only once per 15 seconds
//   const now = Date.now();
//   if ((now - lastGpsSensorRead) / 1000 < 15) {
//     return;
//   }
//   lastGpsSensorRead = Date.now();

//   // update data for other scripts
//   env.setData('CURRENT_GPS_POSITION', {...data, when: Date.now()});

//   // Store GPS
//   if (conf.get('saveGPS', false)) {
//     // this event is re-built like this to keep backwards compatibility
//     const event = MonoUtils.wk.event.regenerateEvent(new GenericEvent('custom-gps', {
//       ...ev.getData(),
//       // speeds is deprecated, but we still want to support it
//       speeds: [] as number[],
//     }, {
//       deviceId: MonoUtils.myID(),
//       login: MonoUtils.currentLogin() || false,
//     }));

//     const saveEvery = conf.get('saveEveryMins', 0);
//     const lastGpsUpdate = Number(env.data.LAST_GPS_UPDATE || '0') || 0;
//     if (saveEvery === 0 || (Date.now() - lastGpsUpdate) > saveEvery * 60 * 1000) {
//       env.setData('LAST_GPS_UPDATE', Date.now());
//       env.project?.saveEvent(event);
//     }
//   }

//   let hadSpeedExcess = false;
//   const speedLimit = conf.get('speedLimit', 0);
//   if (speedLimit > 0) {
//     if (speed > speedLimit) {
//       onSpeedExcess(ev);
//       hadSpeedExcess = true;
//     }
//   }

//   if (!conf.get('enableGeofences', false)) {
//     if (!hadSpeedExcess) {
//       clearAlert();
//     }
//     return;
//   }

//   // check geofences
//   const geofences = conf.get('geofences', []);
  
//   for (const geofence of geofences) {
//     const matchesOurDevice = anyTagMatches(geofence.tags || []);
//     if (!matchesOurDevice) {
//       continue;
//     }

//     const geojson = geofencesCache[geofence.name];
//     if (!geojson) {
//       platform.log(`Geofence ${geofence.name} is invalid`);
//       continue;
//     }

//     if (geojson.type !== 'Polygon') {
//       platform.log(`Geofence ${geofence.name} is not a polygon`);
//       continue;
//     }

//     const wasInside: number | null = getCol()?.data[geofence.name] || null;
//     const isInside = geoPointInPolygon([lon, lat], geojson.coordinates[0]) as boolean;

//     if (isInside && !wasInside) {
//       platform.log(`${geofence.name} is now inside`);
//       getCol()?.set(geofence.name, Date.now());
//       env.project?.saveEvent(new GeofenceEvent(geofence.name, true, ev.getData(), null));
//       tryOpenTaskOrForm(geofence, true);
//     } else if (!isInside && wasInside) {
//       platform.log(`${geofence.name} is now outside`);
//       getCol()?.set(geofence.name, null);
//       env.project?.saveEvent(new GeofenceEvent(geofence.name, false, ev.getData(), wasInside));
//       tryOpenTaskOrForm(geofence, false);
//     }

//     if (isInside && geofence.kind === 'speedLimit') {
//       if (speed > geofence.speedLimit) {
//         hadSpeedExcess = true;
//         onSpeedExcess(ev, geofence);
//       }
//     }

//     if (geofence.kind === 'showForm') {
//       ensureForm(geofence.id, isInside); 
//     }
//   }

//   if (!hadSpeedExcess) {
//     clearAlert();
//   }
// });
