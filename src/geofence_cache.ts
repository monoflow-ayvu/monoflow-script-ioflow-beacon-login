import wellknown, { GeoJSONGeometry } from "wellknown";
import pointInPolygon from '@turf/boolean-point-in-polygon';
import {point, feature, Feature, Polygon} from '@turf/helpers';

class GeofenceCache {
  cache: Map<string, Feature<Polygon>> = new Map();

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
      this.cache.set(name, feature<Polygon>(geojson));
    }
  }

  isInside(geofenceName: string, position: { latitude: number; longitude: number }): boolean {
    const geofence = this.cache.get(geofenceName);
    if (!geofence) {
      return false;
    }

    const p = point([position.latitude, position.longitude]);
    return pointInPolygon(p, geofence);
  }
}

export const geofenceCache = new GeofenceCache();