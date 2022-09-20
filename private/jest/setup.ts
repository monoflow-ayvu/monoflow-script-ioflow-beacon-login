import { EventArgs } from "@fermuch/telematree";
import EventEmitter from "events";
import TypedEmitter from "typed-emitter";
import geoPointInPolygon from 'geo-point-in-polygon';
import { GeofenceManager, Point } from '../../types/global';

class MockGeofenceManager implements GeofenceManager {
  geofences: {id: string; polygon: [number, number][]}[] = [];
  currentPromise: Promise<string[]> | null = null;

  add(id: string, polygon: Point[]): string {
    this.geofences.push({
      id,
      polygon: polygon.map(({lat, lng}) => [lng, lat]),
    });
    return id;
  }

  clear() {
    this.geofences = [];
  }

  anyFenceContains(point: Point): Promise<string[]> {
    const prom = new Promise<string[]>((res) => {
      const results: string[] = [];

      for (const geofence of this.geofences) {
        const isInside = geoPointInPolygon([point.lng, point.lat], geofence.polygon);
        console.warn('checking', [point.lng, point.lat], 'against', geofence, 'gives', isInside);
        if (isInside) {
          results.push(geofence.id)
        }
      }

      res(results);
    })

    this.currentPromise = prom;
    return prom;
  }
}

// setup global environment
beforeAll(() => {
  jest.useFakeTimers();

  const _mockStorage = new Map<string, string | number | boolean>();

  // const global: ScriptGlobal;

  (global as any).platform = {
    log(...args: any[]) {
      console.log(...args);
    },
    // phone-only
    set(key: string, val: string | number | boolean) {
      _mockStorage.set(key, val);
    },
    delete(key: string) {
      _mockStorage.delete(key);
    },
    getString(key: string) {
      return _mockStorage.get(key) as string;
    },
    getBoolean(key: string) {
      return _mockStorage.get(key) as boolean;
    },
    getNumber(key: string) {
      return _mockStorage.get(key) as number;
    },
    geofence: new MockGeofenceManager(),
  };

  // const telematree: telematree;

  (global as any).data = {
    DEVICE_ID: 'TEST',
  };

  // const env: DynamicData['env'];
  (global as any).env = {
    setData(key: string, val: string | number | boolean) {
      (global as any).data[key] = val;
    },
    data: (global as any).data,

    // TODO: add the other functions
  };

  // messages mock
  const eventEmitter = new EventEmitter() as TypedEmitter<EventArgs>
  (eventEmitter as any).on = eventEmitter.on;
  (global as any).emitEventGlobally = (event: any) => {
    eventEmitter.emit('onEvent', event);
  }
  (global as any).messages = eventEmitter;

  // const uuid: v4;
  // const when: FNArgs;

  (global as any).script = undefined;

  const testSettings = {
    isTest: true,
    isDebug: true,
    foo: {
      bar: {
        zaz: 'zaz'
      }
    }
  };
  (global as any).settings = () => testSettings;
  (global as any).getSettings = () => testSettings;
})