import { currentLogin } from "@fermuch/monoutils";
import { GeofenceConfig } from "./config";

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