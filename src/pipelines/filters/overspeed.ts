import { map } from "rxjs";
import { conf } from "../../config";
import { GPSSensorEvent } from "../../events";
import { overspeedGeofences } from "../utils/geofences";
import { geofenceCache } from "../utils/geofence_cache";

export type GPSSensorEventWithSpeeds = GPSSensorEvent & {
  overspeeds: {
    name: string;
    limit: number;
  }[]
}

export function calculateOverspeed() {
  return map<GPSSensorEvent, GPSSensorEventWithSpeeds>(ev => {
    if (!ev) {
      return;
    }
    const data = ev.getData();
    const speed = data.speed * 3.6;

    const overspeeds: {name: string, limit: number}[] = []

    const speedLimit = conf.get('speedLimit', Infinity);
    if (speed > speedLimit) {
      overspeeds.push({name: 'default', limit: speedLimit});
    }

    for (const geofence of overspeedGeofences()) {
      const isInside = geofenceCache.inside(geofence.name, {
        lat: data.latitude,
        lng: data.longitude,
      });

      if (isInside && speed > geofence.speedLimit) {
        overspeeds.push({name: geofence.name, limit: geofence.speedLimit});
      }
    }

    const newEvent = ev as GPSSensorEventWithSpeeds;
    newEvent.overspeeds = overspeeds
    return newEvent;
  })
}