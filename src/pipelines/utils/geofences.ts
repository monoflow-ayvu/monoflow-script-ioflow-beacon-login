import { conf } from "../../config";
import { anyTagMatches } from "./tags";

export function overspeedGeofences() {
  if (!conf.get('enableGeofences', false)) {
    return [];
  }

  return conf
    .get('geofences', [])
    .filter((geofence) => geofence.kind === 'speedLimit')
    .filter((geofence) => anyTagMatches(geofence.tags || []));
}