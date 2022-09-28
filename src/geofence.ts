import { conf } from "./config";
import { GeofenceEvent, GPSSensorEvent } from "./events";
import { geofenceCache } from "./geofence_cache";
import { anyTagMatches, ensureForm, getGeofenceCol, tryOpenTaskOrForm } from "./utils";

let lastGpsSensorRead = 0;

export function onGefence(ev: GPSSensorEvent) {
  // only once per 15 seconds
  const now = Date.now();
  if ((now - lastGpsSensorRead) / 1000 < 15) {
    return;
  }
  lastGpsSensorRead = Date.now();

  // Check Geofences
  const col = getGeofenceCol();
  const geofences = conf.get('enableGeofences', false)
    ? conf.get('geofences', [])
      .filter((g) => g.kind !== 'speedLimit')
      .filter((g) => anyTagMatches(g.tags))
    : [];
  
  for (const geofence of geofences) {
    const isInside = geofenceCache.isInside(geofence.name, ev.getData());
    const wasInside: number | null = col?.data[geofence.name] || null;

    if (isInside && !wasInside) {
      platform.log(`${geofence.name} is now inside`);
      col.set(geofence.name, Date.now());
      env.project?.saveEvent(new GeofenceEvent(geofence.name, true, ev.getData(), null));
      tryOpenTaskOrForm(geofence, true);
    } else if (!isInside && wasInside) {
      platform.log(`${geofence.name} is now outside`);
      col.set(geofence.name, null);
      env.project?.saveEvent(new GeofenceEvent(geofence.name, false, ev.getData(), wasInside));
      tryOpenTaskOrForm(geofence, false);
    }

    if (geofence.kind === 'showForm') {
      ensureForm(geofence.id, isInside); 
    }
  }
}