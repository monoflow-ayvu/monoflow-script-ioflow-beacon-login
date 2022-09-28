import { filter, Observable } from "rxjs";
import { conf } from "../../config";
import { GPSSensorEvent } from "../../events";
import { anyTagMatches } from "./tags";

export function positionQualityFilter() {
  const maxAccuracy = conf.get('maxAccuracy', Infinity);
  return filter<GPSSensorEvent>(ev => {
    const data = ev?.getData?.();

    if(
         data?.speed > -1
      && data?.altitude > -1
      && data?.heading > -1
      && data?.accuracy > -1
      && data?.accuracy <= maxAccuracy
    ) {
      return true;
    }

    return false;
  })
}
