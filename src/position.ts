import * as MonoUtils from "@fermuch/monoutils";
import { conf } from "./config";
import { GenericEvent, GPSSensorEvent } from "./events";

export function onPosition(ev: GPSSensorEvent) {
  // update data for other scripts
  env.setData('CURRENT_GPS_POSITION', { ...data, when: Date.now() });

  // Store GPS
  if (conf.get('saveGPS', false)) {
    // this event is re-built like this to keep backwards compatibility
    const event = MonoUtils.wk.event.regenerateEvent(new GenericEvent('custom-gps', {
      ...ev.getData(),
      // speeds is deprecated, but we still want to support it
      speeds: [] as number[],
    }, {
      deviceId: MonoUtils.myID(),
      login: MonoUtils.currentLogin() || false,
    }));

    const saveEvery = conf.get('saveEveryMins', 0);
    const lastGpsUpdate = Number(env.data.LAST_GPS_UPDATE || '0') || 0;
    if (saveEvery === 0 || (Date.now() - lastGpsUpdate) > saveEvery * 60 * 1000) {
      env.setData('LAST_GPS_UPDATE', Date.now());
      env.project?.saveEvent(event);
    }
  }
}