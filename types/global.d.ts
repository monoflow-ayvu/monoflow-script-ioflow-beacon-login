import TypedEmitter from "typed-emitter";
import {
  KnowPlatformTools as KnownPlatformTools,
  DataProperty,
  DynamicData,
  FN_PROPS,
  FNArgs,
  EventArgs,
} from "@fermuch/telematree/dist/tree/dynamic_data";
import { BaseEvent } from "@fermuch/telematree/dist/events/base_event";
import { ScriptWithInstance } from "@fermuch/telematree/dist/tree/dynamic_data/script_with_instance";
import telematree from "@fermuch/telematree/dist/library";

// Geofence
interface Point {
  lat: number;
  lng: number;
}
declare class GeofenceManager {
  // Adds a geofence to the store.
  // Its points need to be an array of objects of {lat: number; lng: number}
  // Returns the ID.
  add(id: string, polygon: Point[]): string;

  // Clear all locations from the store.
  clear();

  // Checks if any geofence contains this point.
  // Returns an array with all the IDs matching that position.
  anyFenceContains(point: Point): Promise<string[]>;
}

// ** UUID **
type V4Options = RandomOptions | RngOptions;
type v4String = (options?: V4Options) => string;
type v4Buffer = <T extends OutputBuffer>(
  options: V4Options | null | undefined,
  buffer: T,
  offset?: number
) => T;
type v4 = v4Buffer & v4String;

interface ScriptGlobal {
  platform: KnownPlatformTools & { geofence?: GeofenceManager };
  telematree: telematree;
  data: DataProperty;
  env: DynamicData["env"];
  messages: TypedEmitter<EventArgs>;
  uuid: v4;
  when: FNArgs;
}

// ** Globals **
declare global {
  var global: ScriptGlobal;

  var platform: KnownPlatformTools & { geofence?: GeofenceManager };
  var telematree: telematree;
  var data: DataProperty;
  var env: DynamicData["env"];
  var messages: TypedEmitter<EventArgs>;
  var emitEventGlobally: (event: BaseEvent) => void;
  var uuid: v4;
  var when: FNArgs;

  var script: ScriptWithInstance | undefined;
  var settings: undefined | (() => unknown);
  var getSettings: undefined | (() => unknown);
}

declare var global: ScriptGlobal;

declare var platform: KnownPlatformTools;
declare var telematree: telematree;
declare var data: DataProperty;
declare var env: DynamicData["env"];
declare var messages: TypedEmitter<EventArgs>;
declare var emitEventGlobally: (event: BaseEvent) => void;
declare var uuid: v4;
declare var when: FNArgs;

declare var script: ScriptWithInstance | undefined;
declare var settings: undefined | (() => unknown);
declare var getSettings: undefined | (() => unknown);

interface globalThis extends ScriptGlobal {}