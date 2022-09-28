import * as MonoUtils from "@fermuch/monoutils";
import wellknown, { GeoJSONGeometry } from 'wellknown';
import geoPointInPolygon from 'geo-point-in-polygon';
import { CollectionDoc } from "@fermuch/telematree";
import { anyTagMatches, ensureForm, getUrgentNotification, setUrgentNotification, tryOpenTaskOrForm } from "./utils";
import { GPSSensorEvent, SpeedExcessEvent, GenericEvent, GeofenceEvent } from "./events";
import { conf, GeofenceConfig } from "./config";
import { ACTION_OK_OVERSPEED } from "./constants";
import { onOverspeed } from "./overspeed";
import { onGefence } from "./geofence";
import { onPosition } from "./position";
import { geofenceCache } from "./geofence_cache";

const originalFormStates: {
  [id: string]: {
    show: boolean;
  }
} = {};

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

  // pre cache all geofences
  if (conf.get('enableGeofences', false)) {
    for (const geofence of conf.get('geofences', [])) {
      geofenceCache.add(geofence.name, geofence.wkt);
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
})

function onSpeedExcess(ev: GPSSensorEvent, geofence?: GeofenceConfig) {
  if (conf.get('overspeedActivityFilter', true)) {
    let currentAct: { name?: string } = env.data.CURRENT_ACTIVITY || {};
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

  const speed = (ev?.getData().speed || 0) * 3.6;
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
    });
    env.setData('FORCE_VOLUME_LEVEL', 1);
  }
}

MonoUtils.wk.event.subscribe<GPSSensorEvent>('sensor-gps', (ev) => {
  const data = ev.getData();
  const speed = data?.speed * 3.6 || -1;
  if (conf.get('omitNotGPS', false) === true) {
    if (
      // these settings are only provided by the GPS sensor
      data.speed === -1
      || data.altitude === -1
      || data.heading === -1
      || data.accuracy === -1
      || speed === -1
    ) {
      return;
    }
  }

  const maxAccuracy = conf.get('maxAccuracy', 0);
  if (maxAccuracy > 0 && data.accuracy > maxAccuracy) {
    return;
  }

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

  onOverspeed(ev);
  onGefence(ev);
  onPosition(ev);
});

messages.on('onCall', (actId, _payload) => {
  if (actId !== ACTION_OK_OVERSPEED) {
    return;
  }

  setUrgentNotification(null);
})