import wellknown, { GeoJSONGeometry, GeoJSONPolygon } from "wellknown";
import geoPointInPolygon from 'geo-point-in-polygon';

class GeofenceCache {
  cache: Map<string, GeoJSONPolygon> = new Map();

  clear() {
    this.cache.clear();
  }

  add(name: string, geometry: string) {
    let geojson: GeoJSONGeometry | undefined;
    try {
      geojson = wellknown.parse(geometry);
    } catch (e) {
      platform.log(`Error while building geofence ${name}: ${(e as Error).message}`);
      return;
    }

    if (geojson && geojson.type === 'Polygon') {
      this.cache.set(name, geojson);
    }
  }

  isInside(geofenceName: string, position: {latitude: number; longitude: number}): boolean {
    const geofence = this.cache.get(geofenceName);
    if (!geofence) {
      return false;
    }

    return geoPointInPolygon([position.longitude, position.latitude], geofence.coordinates[0]) as boolean;
  }
}

export const geofenceCache = new GeofenceCache();