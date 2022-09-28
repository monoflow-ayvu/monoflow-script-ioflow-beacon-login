import { conf } from "./config";
import { ACTION_OK_OVERSPEED } from "./constants";
import { getUrgentNotification, setUrgentNotification } from "./utils";

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