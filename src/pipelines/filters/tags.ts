import { currentLogin, myID } from "@fermuch/monoutils";
import { Observable } from "rxjs";

export function tagFilterOperator<T>(source: Observable<T>): boolean {
  // we always match if there are no tags
  // if (!tags || tags.length === 0) return true;

  const userTags = env.project?.logins?.find((login) => login.key === currentLogin())?.tags || [];
  const deviceTags = env.project?.usersManager?.users?.find?.((u) => u.$modelId === myID())?.tags || [];
  const allTags = [...userTags, ...deviceTags];

  // return tags.some((t) => allTags.includes(t));

  return false;
}