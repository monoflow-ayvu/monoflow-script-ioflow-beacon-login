import { conf } from "../../config";
import { anyTagMatches } from "./tags";

export function overspeedGeofences() {
  return conf
    .get('geofences', [])
    .filter((geofence) => geofence.kind === 'speedLimit')
    .filter((geofence) => anyTagMatches(geofence.tags || []));
}