import * as MonoUtils from "@fermuch/monoutils";
import { anyTagMatches, ensureForm, getGeofenceManager, setUrgentNotification } from "./utils";
import { GenericEvent, PositionEvent, SpeedEvent } from "./events";
import { conf } from "./config";
import { ACTION_OK_OVERSPEED } from "./constants";
// import { onOverspeed } from "./overspeed";
// import { onGefence } from "./geofence";
// import { onPosition } from "./position";
// import { geofenceCache } from "./geofence_cache";
import wellknown, { GeoJSONGeometry } from "wellknown";
import { onOverspeed } from "./overspeed";
import { onGefence } from "./geofence";
import { onPosition } from "./position";

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

  // request GPS activation
  env.setData('GPS_REQUESTED', true);
  // NOTE: some versions of the monoflow app need to have the GPS_REQUESTED downcased...
  env.setData('gps_requested', true);

  loadGeofences();
});

function loadGeofences(loginId?: string) {
  const manager = getGeofenceManager();
  manager?.clearGeofences();

  // pre cache all geofences
  if (conf.get('enableGeofences', false)) {
    const geofences = conf.get('geofences', []).filter((g) => anyTagMatches(g.tags, loginId));
    for (const geofence of geofences) {
      let geojson: GeoJSONGeometry | undefined;
      try {
        geojson = wellknown.parse(geofence.wkt);
      } catch (e) {
        platform.log(`Error while building geofence ${geofence.name}: ${(e as Error).message}`);
        return;
      }
  
      if (geojson && geojson.type === 'Polygon') {
        manager?.addGeofence(
          geofence.name,
          geojson.coordinates[0].map((p) => ({lng: p[0], lat: p[1]}))
        )
      }
    }
  }
}

// on exit restore original form states
messages.on('onEnd', () => {
  restoreforms();
  getGeofenceManager()?.clearGeofences();
});

// on logout restore original form states
messages.on('onLogout', () => {
  restoreforms();
  getGeofenceManager()?.clearGeofences();
});

messages.on('onLogin', (loginId) => {
  loadGeofences(loginId);
})

MonoUtils.wk.event.subscribe<SpeedEvent>('sensor-speed', (ev) => {
  const data = ev.getData()
  const speed = data.speed * 3.6 || -1;
  env.setData('CURRENT_SPEED_KMH', speed > 0.0 ? speed : 0.001);
  env.setData('CURRENT_SPEED_ACCURACY', data.accuracy || -1);
});

MonoUtils.wk.event.subscribe<PositionEvent>('sensor-gps', (ev) => {
  const data = ev.getData();
  const speed = data?.speed * 3.6 || -1;

  const impossibleRules = conf.get('impossible', []);
  for (const impRule of impossibleRules) {
    // for now we only check for speed, so if no speed is given we ignore the rule
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

  // handle overspeed
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