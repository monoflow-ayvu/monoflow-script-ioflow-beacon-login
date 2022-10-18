import { conf } from "./config";
import { ACTION_OK_OVERSPEED } from "./constants";
import { GPSSensorEvent, SpeedExcessEvent } from "./events";
import { geofenceCache } from "./geofence_cache";
import { anyTagMatches, clearAlert, setUrgentNotification } from "./utils";

function handleOverspeed(ev: GPSSensorEvent, name: string, limit: number) {
  if (conf.get('overspeedActivityFilter', true)) {
    let currentAct: { name?: string } = env.data.CURRENT_ACTIVITY || {};
    if (typeof currentAct === 'string') {
      try {
        currentAct = JSON.parse(currentAct);
      } catch {
        // pass
      }
    }

    if (currentAct?.name === 'STILL') {
      platform.log('speed limit omitted since currenct activity is STILL');
      return;
    }
  }

  const speed = (ev?.getData().speed || 0) * 3.6;
  const speedLimit = limit || conf.get('speedLimit', 0) || 0;
  platform.log(`Speed limit reached: ${speed} km/h (limit: ${speedLimit} km/h)`);
  env.project?.saveEvent(
    new SpeedExcessEvent(
      name || 'default',
      ev.getData(),
      speedLimit
    )
  );

  if (conf.get('warnUserOverspeed', false)) {
    let buttons = [];
    if (conf.get('showOkButtonForAlert', true)) {
      buttons.push({
        action: ACTION_OK_OVERSPEED,
        name: 'OK',
        payload: {},
      })
    }

    setUrgentNotification({
      title: 'Límite de velocidade',
      color: '#d4c224',
      message: 'Foi detectado um excesso de velocidade',
      urgent: true,
      actions: buttons,
    });
    env.setData('FORCE_VOLUME_LEVEL', 1);
  }
}

function handleSpeedAlert(ev: GPSSensorEvent, name: string, limit: number) {
  
}

let lastGpsSensorRead = 0;
let positionsCache: GPSSensorEvent[] = [];

export function onOverspeed(newEvent: GPSSensorEvent) {
  positionsCache.push(newEvent);
  // only once per 5 seconds
  const now = Date.now();
  if ((now - lastGpsSensorRead) / 1000 < 5) {
    return;
  }
  lastGpsSensorRead = Date.now();

  // impossible to have less than one event
  const ev = positionsCache.sort((a, b) => b.getData().speed - a.getData().speed)[0]
  positionsCache = [];

  const data = ev.getData();
  const speed = data.speed * 3.6;
  let hadSpeedExcess = false;

  const speedLimit = conf.get('speedLimit', Infinity);
  const alertMinimum = conf.get('speedPreLimit', 0);
  if (speed > speedLimit) {
    handleOverspeed(ev, 'default', speedLimit);
    hadSpeedExcess = true;
  } else if (alertMinimum > 0 && speed >= alertMinimum) {
    handleSpeedAlert(ev, 'default', alertMinimum);
  }

  const speedGeofences = conf.get('enableGeofences', false)
    ? conf.get('geofences', [])
      .filter((g) => g.kind === 'speedLimit')
      .filter((g) => anyTagMatches(g.tags))
    : [];

  for (const fence of speedGeofences) {
    const isInside = geofenceCache.isInside(fence.name, ev.getData());
    const fenceAlertMinimum = fence.speedPreLimit || 0;
    if (isInside && speed > fence.speedLimit) {
      hadSpeedExcess = true;
      handleOverspeed(ev, fence.name, fence.speedLimit);
    } else if (fenceAlertMinimum > 0 && speed >= fenceAlertMinimum) {
      handleSpeedAlert(ev, fence.name, fence.speedLimit);
    }
  }

  if (!hadSpeedExcess) {
    clearAlert();
  }
}