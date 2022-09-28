import { conf } from "./config";
import { ACTION_OK_OVERSPEED } from "./constants";
import { SpeedExcessEvent } from "./events";
import { GPSSensorEventWithSpeeds } from "./pipelines/filters/overspeed";
import { setUrgentNotification } from "./utils";

export function onOverspeed(event: GPSSensorEventWithSpeeds) {
  if (conf.get('overspeedActivityFilter', true)) {
    let currentAct: {name?: string} = env.data.CURRENT_ACTIVITY || {};
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


  const speed = (event?.getData?.()?.speed || 0) * 3.6;
  for (const geofence of event.overspeeds) {
    const speedLimit = geofence.limit || 0;
    platform.log(`Speed limit reached: ${speed} km/h (limit: ${speedLimit} km/h)`);
    env.project?.saveEvent(
      new SpeedExcessEvent(
        geofence?.name || 'default',
        event.getData(),
        speedLimit
      )
    );
  }
}