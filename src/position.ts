import * as MonoUtils from "@fermuch/monoutils";
import { getGeofenceCollection } from "./collections";
import { conf } from "./config";
import { GenericEvent, GeofenceEvent, GPSSensorEvent } from "./events";
import { ensureForm, tryOpenTaskOrForm } from "./forms_and_tasks";
import { geofenceCache } from "./pipelines/utils/geofence_cache";
import { anyTagMatches } from "./pipelines/utils/tags";

export function onPosition(event: GPSSensorEvent) {
  const data = event.getData();
  const speed = data.speed * 3.6;
  const lat = data.latitude;
  const lng = data.longitude;

  env.setData('CURRENT_GPS_POSITION', {...data, when: Date.now()});

  // save positions
  if (conf.get('saveGPS', false)) {
    // this event is re-built like this to keep backwards compatibility
    const event = MonoUtils.wk.event.regenerateEvent(new GenericEvent('custom-gps', {
      ...data,
      // speeds is deprecated, but we don't want to break the database
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

  const geofences = conf.get('geofences', []);
  const col = getGeofenceCollection();

  for (const geofence of geofences) {
    const matchesOurDevice = anyTagMatches(geofence.tags || []);
    if (!matchesOurDevice) {
      continue;
    }

    const isInside = geofenceCache.inside(geofence.name, {
      lat,
      lng,
    })
    const wasInside: number | null = getGeofenceCollection()?.data[geofence.name] || null;

    if (isInside && !wasInside) {
      platform.log(`${geofence.name} is now inside`);
      col?.set(geofence.name, Date.now());
      env.project?.saveEvent(new GeofenceEvent(geofence.name, true, data, null));
      tryOpenTaskOrForm(geofence, true);
    } else if (!isInside && wasInside) {
      platform.log(`${geofence.name} is now outside`);
      col?.set(geofence.name, null);
      env.project?.saveEvent(new GeofenceEvent(geofence.name, false, data, wasInside));
      tryOpenTaskOrForm(geofence, false);
    }

    if (geofence.kind === 'showForm') {
      ensureForm(geofence.id, isInside); 
    }
  }
}