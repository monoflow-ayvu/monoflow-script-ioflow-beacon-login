import * as MonoUtils from '@fermuch/monoutils';
import * as sinon from 'sinon';
import { conf } from './config';
import { GenericEvent } from './events';
import { overSpeed$ } from './pipelines';
import { geofenceCache } from './pipelines/utils/geofence_cache';
const read = require('fs').readFileSync;
const join = require('path').join;

const clock = sinon.useFakeTimers();

// export function loadScript() {
//   // import global script
//   const script = read(join(__dirname, '..', 'dist', 'bundle.js')).toString('utf-8');
//   eval(script);
// }

export class MockGPSEvent extends MonoUtils.wk.event.BaseEvent {
  kind = 'sensor-gps' as const;

  constructor(
    private readonly latitude = 1,
    private readonly longitude = 1,
    private readonly accuracy = 1,
    private readonly speed = 1,
  ) {
    super();
  }

  getData() {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
      altitude: 1,
      accuracy: this.accuracy,
      altitudeAccuracy: 1,
      heading: 1,
      speed: this.speed,
    };
  }
}

function fakeOnInit() {
  if (conf.get('enableGeofences', false)) {
    for (const geofence of conf.get('geofences', [])) {
      geofenceCache.save(geofence.name, geofence.wkt);
    }
  }
}

describe("pipelines", () => {
  afterEach(() => { clock.restore(); });

  beforeAll(() => {
    const colStore = {} as Record<any, any>;
    const mockCol = {
      get() {
        return {
          data: colStore,
          get: (k: string) => colStore[k],
          set: (k: string, v: any) => (colStore[k] = v),
        }
      }
    };

    (env.project as any) = {
      collectionsManager: {
        ensureExists: () => mockCol,
      },
      saveEvent: jest.fn()
    };
  })

  afterEach(() => {
    // clean listeners
    messages.removeAllListeners();
    env.setData('LAST_GPS_UPDATE', null);
  });

  describe("overspeed", () => {
    it('only runs once for the highest speed geofence every 5 seconds', () => {
      getSettings = () => ({
        enableGeofences: true,
        geofences: [{
          name: 'testfence',
          kind: 'speedLimit',
          wkt: 'POLYGON((0 0, 0 2, 2 2, 2 0, 0 0))',
          speedLimit: 2.1,
        }]
      })
      conf.reload();
      fakeOnInit();
      const spy = jest.fn();
      overSpeed$.subscribe(spy);

      const slowEvent = new MockGPSEvent(1, 1, 1, 1);
      const fastEvent = new MockGPSEvent(1, 1, 1, 5);

      expect(spy).not.toHaveBeenCalled();
      messages.emit('onEvent', slowEvent);
      messages.emit('onEvent', slowEvent);
      messages.emit('onEvent', slowEvent);
      messages.emit('onEvent', fastEvent);
      messages.emit('onEvent', slowEvent);
      messages.emit('onEvent', slowEvent);
      clock.tick(5000);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]?.getData?.()).toStrictEqual(fastEvent.getData());
      expect(spy.mock.calls[0][0]?.overspeeds).toStrictEqual([{ name: 'testfence', limit: 2.1 }])
    });

    xit("emits overspeeds array for global overspeed", () => { });
  });
});
