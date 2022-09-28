import { GPSSensorEventWithSpeeds } from "./pipelines/filters/overspeed";

export function onOverspeed(event: GPSSensorEventWithSpeeds) {
  platform.log(event.overspeeds);
}