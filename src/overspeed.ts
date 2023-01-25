import { conf } from "./config";
import { ACTION_OK_OVERSPEED } from "./constants";
import { PositionEvent, SpeedExcessEvent, SpeedPreExcessEvent } from "./events";
import { clearAlert, myFences, setUrgentNotification } from "./utils";

function handleOverspeed(ev: PositionEvent, name: string, limit: number) {
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

function handleSpeedAlert(ev: PositionEvent, name: string, limit: number) {
  setUrgentNotification({
    title: `Perto do límite de velocidade para: ${name}`,
    color: '#d09885',
    message: `Sua velocidade atual fica perto do límite de velocidade (${limit} km/h)`,
    urgent: true,
    actions: [{
      action: ACTION_OK_OVERSPEED,
      name: 'OK',
      payload: {},
    }],
  });

  env.project?.saveEvent(
    new SpeedPreExcessEvent(
      name || 'default',
      ev.getData(),
      limit
    )
  );
}

export function onOverspeed(ev: PositionEvent) {
  const data = ev.getData();
  const speed = data.speed * 3.6;
  let hadSpeedExcess = false;

  const speedLimit = conf.get('speedLimit', Infinity);
  const alertMinimum = conf.get('speedPreLimit', 0);
  if (speed >= speedLimit) {
    handleOverspeed(ev, 'default', speedLimit);
    hadSpeedExcess = true;
  } else if (alertMinimum > 0 && speed >= alertMinimum) {
    handleSpeedAlert(ev, 'Global', alertMinimum);
    hadSpeedExcess = true;
  }

  const speedGeofences = myFences('speedLimit');
  for (const fence of speedGeofences) {
    // const isInside = geofenceCache.isInside(fence.name, data);
    const isInside = data.geofences?.[fence.name] || false
    const fenceAlertMinimum = fence.speedPreLimit || 0;
    const fenceSpeedLimit = Number(fence.speedLimit);
    if (isInside && speed >= fenceSpeedLimit) {
      hadSpeedExcess = true;
      handleOverspeed(ev, fence.name, fence.speedLimit);
    } else if (isInside && fenceAlertMinimum > 0 && speed >= fenceAlertMinimum) {
      hadSpeedExcess = true;
      handleSpeedAlert(ev, fence.name, fenceSpeedLimit);
    }
  }

  if (!hadSpeedExcess) {
    clearAlert();
  }
}