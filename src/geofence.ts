import { GeofenceEvent, PositionEvent } from "./events";
import { myFences, ensureForm, getGeofenceCol, tryOpenTaskOrForm } from "./utils";

let lastGpsSensorRead = 0;

export function onGefence(ev: PositionEvent) {
  // only once per 45 seconds
  const now = Date.now();
  if ((now - lastGpsSensorRead) / 1000 < 45) {
    return;
  }
  lastGpsSensorRead = Date.now();
  const data = ev.getData();

  // Check Geofences
  const col = getGeofenceCol();
  const geofences = myFences().filter((g) => g.kind !== 'speedLimit');
  
  for (const geofence of geofences) {
    const isInside = data.geofences?.[geofence.name] || false
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