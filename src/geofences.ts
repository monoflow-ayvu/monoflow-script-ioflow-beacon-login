import { parse, GeoJSONGeometry } from "wellknown";
import { conf, GeofenceConfig } from "./config";

const geofencesCache: Record<string, GeoJSONGeometry> = {};

function getAllFences(): GeofenceConfig[] {
  if (conf.get('enableGeofences', false) === false) {
    return [];
  }

  const geofences = conf.get('geofences', []);
  const validFences: GeofenceConfig[] = [];
  for (const geofence of geofences) {
    let geojson: GeoJSONGeometry | undefined;

    if (!geofencesCache || !geofencesCache[geofence.name]) {
      try {
        geojson = parse(geofence.wkt);
      } catch (e) {
        platform.log(`Error while building geofence ${geofence.name}: ${(e as Error).message}`);
        continue;
      }

      if (geojson) {
        geofencesCache[geofence.name] = geojson;
      }
    }

    validFences.push(geofence);
  }

  return validFences;
}

export function getNormalFences(): GeofenceConfig[] {
  return getAllFences().filter((f) => [
    'default',
    'openForm',
    'openTask',
    'showForm',
  ].includes(f.kind))
}

export function getSpeedFences(): GeofenceConfig[] {
  return getAllFences().filter((f) => f.kind === 'speedLimit');
}