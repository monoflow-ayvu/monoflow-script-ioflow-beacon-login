import wellknown, { GeoJSONGeometry } from "wellknown";
import geoPointInPolygon from 'geo-point-in-polygon';

class GeofenceCache {
  cache: Map<string, GeoJSONGeometry> = new Map();

  clear() {
    this.cache.clear();
  }

  save(name: string, geometry: string) {
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

  inside(geofenceName: string, position: {lat: number; lng: number}): boolean {
    const geofence = this.cache.get(geofenceName);
    if (!geofence) {
      return false;
    }

    return geoPointInPolygon([position.lng, position.lat], geofence[0].coordinates[0]) as boolean;
  }
}

export const geofenceCache = new GeofenceCache();