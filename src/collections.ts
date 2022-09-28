import { myID } from "@fermuch/monoutils";
import { CollectionDoc } from "@fermuch/telematree";

type GeofenceCol = {
  insideSince: number | null;
  [geofenceName: string]: number | null;
}

export function getGeofenceCollection(): CollectionDoc<GeofenceCol> | undefined {
  const col = env.project?.collectionsManager.ensureExists<GeofenceCol>('geofence', 'Geofence');
  return col.get(myID());
}