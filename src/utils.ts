import { currentLogin, myID } from "@fermuch/monoutils";
import { Point } from "../types/global";

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

export function clearGeofences() {
  platform?.geofence?.clear?.();
}

export function addGeofence(id: string, geofence: Point[]) {
  return platform?.geofence?.add?.(id, geofence) || '';
}

export function isInsideGeofence(point: Point): Promise<string[]> | null {
  return platform?.geofence?.anyFenceContains?.(point);
}

export function anyTagMatches(tags: string[]): boolean {
  // we always match if there are no tags
  if (!tags || tags.length === 0) return true;

  const userTags = env.project?.logins?.find((login) => login.key === currentLogin())?.tags || [];
  const deviceTags = env.project?.usersManager?.users?.find?.((u) => u.$modelId === myID())?.tags || [];
  const allTags = [...userTags, ...deviceTags];

  return tags.some((t) => allTags.includes(t));
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
