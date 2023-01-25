import { currentLogin, myID } from "@fermuch/monoutils";
import { CollectionDoc } from "@fermuch/telematree";
import { conf, GeofenceConfig } from "./config";
import { ACTION_OK_OVERSPEED } from "./constants";

export function wakeup() {
  if ('wakeup' in platform) {
    (platform as unknown as { wakeup: () => void }).wakeup();
  }
}

interface Action {
  name: string;
  action: string;
  payload: unknown;
}

type UrgentNotification = {
  title: string;
  message?: string;
  color?: string;
  actions?: Action[];
  urgent?: boolean;
} | null;

export function setUrgentNotification(notification: UrgentNotification) {
  if (!('setUrgentNotification' in platform)) {
    return;
  }

  if (notification !== null) {
    wakeup();
  }

  (platform as unknown as { setUrgentNotification: (notification: UrgentNotification) => void }).setUrgentNotification(notification);
}

export function getUrgentNotification(): UrgentNotification | null {
  if (!('getUrgentNotification' in platform)) {
    return null;
  }

  return (platform as unknown as { getUrgentNotification: () => UrgentNotification | null }).getUrgentNotification();
}

export function tryOpenTaskOrForm(geofence: GeofenceConfig, isOnEnter: boolean) {
  if (geofence.kind !== 'openForm' && geofence.kind !== 'openTask') {
    return;
  }

  if (!currentLogin()) {
    return;
  }

  if (env.data.CURRENT_PAGE === 'Submit') {
    return;
  }

  if (isOnEnter && !geofence.when.onEnter) {
    return;
  }

  if (!isOnEnter && !geofence.when.onExit) {
    return;
  }

  if (!('goToSubmit' in platform)) {
    platform.log('no goToSubmit platform tool available');
    return;
  }

  platform.log(`showing ${geofence.kind === 'openForm' ? 'form' : 'task'}: ${geofence.id}`);
  (platform as unknown as { gotToSubmit: (formId?: string, taskId?: string) => void })?.gotToSubmit?.(
    geofence.kind === 'openForm' ? geofence.id : '',
    geofence.kind === 'openTask' ? geofence.id : ''
  );
}

export function ensureForm(formId: string, show: boolean) {
  if (!formId) return;
  const form = env.project?.formsManager?.forms?.find((page) => page.$modelId === formId)
  if (!form) return;

  const changes = {};

  if (form.show !== show) {
    changes['show'] = show;
  }

  if (form.autonomous !== show) {
    changes['autonomous'] = show;
  }

  if (Object.keys(changes).length > 0) {
    form._setRaw(changes);
  }
}

export function anyTagMatches(tags: string[], loginId?: string): boolean {
  // we always match if there are no tags
  if (!tags || tags.length === 0) return true;

  const loginName = loginId || currentLogin() || '';
  const userTags = env.project?.logins?.find((login) => login.key === loginName || login.$modelId === loginName)?.tags || [];
  const deviceTags = env.project?.usersManager?.users?.find?.((u) => u.$modelId === myID())?.tags || [];
  const allTags = [...userTags, ...deviceTags];

  return tags.some((t) => allTags.includes(t));
}

export function clearAlert() {
  if (conf.get('autoDisableOverSpeedAlert', true) === false) {
    return;
  }

  const notif = getUrgentNotification();
  if (!notif) return;

  const isOverspeed = notif.actions?.some((n) => n.action === ACTION_OK_OVERSPEED);
  if (isOverspeed) {
    setUrgentNotification(null);
  }
}

export type GeofenceCol = {
  insideSince: number | null;
  [geofenceName: string]: number | null;
}

export function getGeofenceCol(): CollectionDoc<GeofenceCol> | undefined {
  const col = env.project?.collectionsManager.ensureExists<GeofenceCol>('geofence', 'Geofence');
  return col.get(myID());
}

interface Point {
  lat: number;
  lng: number;
}

export interface GeofenceManager {
  addGeofence(id: string, polygon: Point[]): string;
  clearGeofences(): void;
}

export function getGeofenceManager(): GeofenceManager | null {
  if ('geofence' in platform) {
    return (platform as unknown as { geofence: GeofenceManager }).geofence
  }
  return null
}

export function myFences(kind?: GeofenceConfig['kind']) {
  if (!conf.get('enableGeofences', false)) {
    return []
  }
  const fences = conf.get('geofences', []).filter((g) => anyTagMatches(g.tags)) || []
  if (kind) {
    return fences.filter((f) => f.kind === kind);
  } else {
    return fences;
  }
}