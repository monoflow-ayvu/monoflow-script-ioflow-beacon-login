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

export function contentGeofences() {
  if (!conf.get('enableGeofences', false)) {
    return [];
  }

  return conf
    .get('geofences', [])
    .filter((geofence) => ['openForm', 'openTask', 'showForm'].includes(geofence.kind))
    .filter((geofence) => anyTagMatches(geofence.tags || []));
}

export function normalGeofences() {
  if (!conf.get('enableGeofences', false)) {
    return [];
  }

  return conf
    .get('geofences', [])
    .filter((geofence) => geofence.kind === 'default')
    .filter((geofence) => anyTagMatches(geofence.tags || []));
}