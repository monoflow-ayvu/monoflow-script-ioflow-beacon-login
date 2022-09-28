import * as MonoUtils from '@fermuch/monoutils';
import { GPSSensorEvent } from '../events';
import { Observable } from "rxjs";
import { bufferTime, map } from "rxjs/operators";
import { positionQualityFilter } from './filters/position_quality';
import { filterImpossibleSpeeds } from './filters/impossible_speed';

const position = new Observable<GPSSensorEvent>((sub) => {
  MonoUtils.wk.event.subscribe<GPSSensorEvent>('sensor-gps', (ev) => {
    sub.next(ev);
  });

  messages.on('onEnd', () => {
    sub.complete();
  });
});

// overspeed pipeline only tracks fastest event in the interval
const OVERSPEED_PIPELINE_TIMEBUFFER = 5000; // 5 seconds;
export const overSpeed$ = position.pipe(
  positionQualityFilter(),
  filterImpossibleSpeeds(),
  bufferTime(OVERSPEED_PIPELINE_TIMEBUFFER),
  map((events) => events.sort((a, b) => b.getData().speed - a.getData().speed)[0]),
);