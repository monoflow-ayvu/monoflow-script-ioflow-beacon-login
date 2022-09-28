import { filter } from "rxjs";
import { conf } from "../../config";
import { GPSSensorEvent } from "../../events";
import { anyTagMatches } from "./tags";

export function filterImpossibleSpeeds() {
  const impossibleRules = conf.get('impossible', []);
  return filter<GPSSensorEvent>(ev => {
    const speed = ev.getData().speed * 3.6;

    for (const impRule of impossibleRules) {
      // for now we only check for speed, so if no speed is giving we ignore the rule
      if (impRule.maxSpeed === 0) continue;
  
      // check for global rules
      if ((impRule.tags || []).length === 0 && speed > impRule.maxSpeed) {
        return false; // cancel this event
      }
  
      // tagged rules
      if (anyTagMatches(impRule.tags) && speed > impRule.maxSpeed) {
        return false; // cancel this event
      }
    }

    return true;
  });
}