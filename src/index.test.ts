import * as MonoUtils from '@fermuch/monoutils';
import { GenericEvent } from './events';
const read = require('fs').readFileSync;
const join = require('path').join;

function loadScript() {
  // import global script
  const script = read(join(__dirname, '..', 'dist', 'bundle.js')).toString('utf-8');
  eval(script);
}

class MockGPSEvent extends MonoUtils.wk.event.BaseEvent {
  kind = 'sensor-gps' as const;

  constructor(
    private readonly latitude = 1,
    private readonly longitude = 1,
    private readonly accuracy = 1,
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
      speed: 1,
    };
  }
}

describe("onInit", () => {
  jest.useFakeTimers('modern');

  afterEach(() => {
    // clean listeners
    messages.removeAllListeners();
    env.setData('LAST_GPS_UPDATE', null);
  });

  it('loads the script correctly', () => {
    loadScript();
    messages.emit('onInit');
  })

  it('requests for GPS to be enabled', () => {
    loadScript();
    messages.emit('onInit');
    expect(env.data.GPS_REQUESTED).toBe(true);
  });

  it('sets GPS configuration', () => {
    loadScript();
    messages.emit('onInit');
    expect(env.data.GPS_TIMEOUT).toBeTruthy();
    expect(env.data.GPS_MAXIMUM_AGE).toBeTruthy();
    expect(env.data.GPS_HIGH_ACCURACY).toBeTruthy();
    expect(env.data.GPS_DISTANCE_FILTER).toBeTruthy();
    expect(env.data.GPS_USE_SIGNIFICANT_CHANGES).toBeTruthy();
  });

  it('emits custom-gps if saveGPS is enabled', () => {
    getSettings = () => ({
      saveGPS: true,
    });
    (env.project as any) = {
      saveEvent: jest.fn(),
    };

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent());
    expect(env.project.saveEvent).toHaveBeenCalledTimes(1);

    const saved = (env.project.saveEvent as jest.Mock<any, any>).mock.calls[0][0] as GenericEvent<{}>;
    expect(saved.kind).toBe('generic');
    expect(saved.getData().type).toBe('custom-gps');
  });

  it('sends only one update every X mins if saveEveryMins is set', () => {
    getSettings = () => ({
      saveGPS: true,
      saveEveryMins: 1 / 60, // one second
    });
    (env.project as any) = {
      saveEvent: jest.fn(),
    };

    loadScript();
    messages.emit('onInit');
    jest.setSystemTime(new Date('2020-01-01 00:00:00'));
    messages.emit('onEvent', new MockGPSEvent());
    messages.emit('onEvent', new MockGPSEvent());
    messages.emit('onEvent', new MockGPSEvent());
    messages.emit('onEvent', new MockGPSEvent());
    messages.emit('onEvent', new MockGPSEvent());
    expect(env.project.saveEvent).toHaveBeenCalledTimes(1);
    jest.setSystemTime(new Date('2020-01-01 00:00:01'));
    messages.emit('onEvent', new MockGPSEvent());
    messages.emit('onEvent', new MockGPSEvent());
    messages.emit('onEvent', new MockGPSEvent());
    expect(env.data.LAST_GPS_UPDATE).toBeGreaterThan(0);
    expect(env.project.saveEvent).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2020-01-01 00:01:00'));
    messages.emit('onEvent', new MockGPSEvent());
    expect(env.project.saveEvent).toHaveBeenCalledTimes(2);
  });

  it('emits GeofenceEvent when entering and exiting geofence if enableGeofences is enabled', () => {
    getSettings = () => ({
      enableGeofences: true,
      geofences: [{
        name: 'testfence',
        kind: 'default',
        wkt: 'POLYGON((0 0, 0 2, 2 2, 2 0, 0 0))',
      }]
    });

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

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent());

    expect(colStore['testfence']).toBeTruthy();
    expect(env.project.saveEvent).toHaveBeenCalledTimes(1);
    const call = (env.project.saveEvent as jest.Mock<any, any>).mock.calls[0];
    expect(call[0].kind).toBe('geofence');
    expect(call[0].getData().entering).toBe(true);
    expect(call[0].getData().exiting).toBe(false);

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent(200, 200));

    expect(colStore['testfence']).toBeFalsy();
    expect(env.project.saveEvent).toHaveBeenCalledTimes(2);
    const call2 = (env.project.saveEvent as jest.Mock<any, any>).mock.calls[1];
    expect(call2[0].kind).toBe('geofence');
    expect(call2[0].getData().entering).toBe(false);
    expect(call2[0].getData().exiting).toBe(true);
  });

  it('emits GeofenceEvent when entering and exiting geofence if any geofence tag matches', () => {
    getSettings = () => ({
      enableGeofences: true,
      geofences: [{
        name: 'testfence',
        kind: 'default',
        wkt: 'POLYGON((0 0, 0 2, 2 2, 2 0, 0 0))',
        tags: ['foo', 'bar', 'zaz']
      }]
    });

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
      saveEvent: jest.fn(),
      usersManager: {
        users: [{
          $modelId: 'TEST',
          tags: ['zaz'],
        }]
      }
    };

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent());

    expect(colStore['testfence']).toBeTruthy();
    expect(env.project.saveEvent).toHaveBeenCalledTimes(1);
    const call = (env.project.saveEvent as jest.Mock<any, any>).mock.calls[0];
    expect(call[0].kind).toBe('geofence');
    expect(call[0].getData().entering).toBe(true);
    expect(call[0].getData().exiting).toBe(false);

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent(200, 200));

    expect(colStore['testfence']).toBeFalsy();
    expect(env.project.saveEvent).toHaveBeenCalledTimes(2);
    const call2 = (env.project.saveEvent as jest.Mock<any, any>).mock.calls[1];
    expect(call2[0].kind).toBe('geofence');
    expect(call2[0].getData().entering).toBe(false);
    expect(call2[0].getData().exiting).toBe(true);
  });

  it('does NOT emit GeofenceEvent when entering and exiting geofence if no geofence tag matches', () => {
    getSettings = () => ({
      enableGeofences: true,
      geofences: [{
        name: 'testfence',
        kind: 'default',
        wkt: 'POLYGON((0 0, 0 2, 2 2, 2 0, 0 0))',
        tags: ['foo', 'bar', 'zaz']
      }]
    });

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
      saveEvent: jest.fn(),
      usersManager: {
        users: [{
          $modelId: 'TEST',
          tags: ['some-other-tag'],
        }]
      }
    };

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent());

    expect(colStore['testfence']).not.toBeDefined();
    expect(env.project.saveEvent).not.toHaveBeenCalledTimes(1);

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent(200, 200));

    expect(colStore['testfence']).not.toBeDefined();
    expect(env.project.saveEvent).not.toHaveBeenCalledTimes(2);
  });

  it('emits SpeedExcessEvent when speed is over the limit if enableSpeedExcess is enabled', () => {
    getSettings = () => ({
      enableGeofences: true,
      geofences: [{
        name: 'speedfence',
        kind: 'speedLimit',
        wkt: 'POLYGON((0 0, 0 2, 2 2, 2 0, 0 0))',
        speedLimit: 0.42,
      }]
    });

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

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent());

    expect(colStore['speedfence']).toBeTruthy();
    expect(env.project.saveEvent).toHaveBeenCalledTimes(2);
    const call = (env.project.saveEvent as jest.Mock<any, any>).mock.calls[0];
    expect(call[0].kind).toBe('geofence');
    expect(call[0].getData().entering).toBe(true);
    expect(call[0].getData().exiting).toBe(false);

    const call2 = (env.project.saveEvent as jest.Mock<any, any>).mock.calls[1];
    expect(call2[0].kind).toBe('speed-excess');
    expect(call2[0].getData().gps.speed).toBe(1);
    expect(call2[0].getData().speedLimit).toBe(0.42);
  });

  it('emits SpeedExcessEvent when speed is over the limit speedLimit is set', () => {
    getSettings = () => ({
      speedLimit: 0.42,
    });

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

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent());

    expect(env.project.saveEvent).toHaveBeenCalledTimes(1);
    const call = (env.project.saveEvent as jest.Mock<any, any>).mock.calls[0];
    expect(call[0].kind).toBe('speed-excess');
    expect(call[0].getData().name).toBe('default');
    expect(call[0].getData().gps.speed).toBe(1);
    expect(call[0].getData().speedLimit).toBe(0.42);
  });
});

describe('impossible values', () => {
  afterEach(() => {
    messages.removeAllListeners();
  });

  it('does not block normal events when speed is normal', () => {
    getSettings = () => ({
      speedLimit: 0.42,
      impossible: [{
        tags: [],
        maxSpeed: 99999,
      }],
    });

    (env.project as any) = {
      collectionsManager: {
        ensureExists: jest.fn(),
      },
      saveEvent: jest.fn()
    };

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent());

    expect(env.project.saveEvent).toHaveBeenCalled();
  });

  it('applies to all gps events when no tag is set', () => {
    getSettings = () => ({
      speedLimit: 0.00001,
      impossible: [{
        tags: [],
        maxSpeed: 0.1,
      }],
    });

    (env.project as any) = {
      collectionsManager: {
        ensureExists: jest.fn(),
      },
      saveEvent: jest.fn()
    };

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent());

    expect(env.project.saveEvent).not.toHaveBeenCalled();
  });

  describe('applies speedlimit only to device tags', () => {
    beforeAll(() => {
      getSettings = () => ({
        speedLimit: 0.00001,
        impossible: [{
          tags: ['impossible-tag'],
          maxSpeed: 0.1,
        }],
      });
    })

    it('does not apply to untagged devices', () => {
      (env.project as any) = {
        collectionsManager: {
          ensureExists: jest.fn(),
        },
        saveEvent: jest.fn(),
        usersManager: {
          users: [{
            $modelId: 'TEST',
            tags: [],
          }]
        }
      };
  
      loadScript();
      messages.emit('onInit');
      messages.emit('onEvent', new MockGPSEvent());
  
      // only 
      expect(env.project.saveEvent).toHaveBeenCalled();
    });

    it('applies to matching tagged devices', () => {
      (env.project as any) = {
        collectionsManager: {
          ensureExists: jest.fn(),
        },
        saveEvent: jest.fn(),
        usersManager: {
          users: [{
            $modelId: 'TEST',
            tags: ['impossible-tag'],
          }]
        }
      };

      loadScript();
      messages.emit('onInit');
      messages.emit('onEvent', new MockGPSEvent());

      expect(env.project.saveEvent).not.toHaveBeenCalled();
    });
  });
});

describe("signal quality filters", () => {
  afterEach(() => {
    messages.removeAllListeners();
  });

  it("omitNotGPS=true omits signals from NOT the gps", () => {
    getSettings = () => ({
      saveGPS: true,
      omitNotGPS: true,
    });
    (env.project as any) = {
      saveEvent: jest.fn(),
    };

    loadScript();
    messages.emit('onInit');
    messages.emit('onEvent', new MockGPSEvent(1, 1, -1));
    expect(env.project.saveEvent).toHaveBeenCalledTimes(0);
  });

  it("maxAccuracy=10 omits signals with higher level of accuracy", () => {
    getSettings = () => ({
      saveGPS: true,
      maxAccuracy: 10
    });
    (env.project as any) = {
      saveEvent: jest.fn(),
    };

    loadScript();
    messages.emit('onInit');

    // over the limit
    messages.emit('onEvent', new MockGPSEvent(1, 1, 11));
    expect(env.project.saveEvent).toHaveBeenCalledTimes(0);

    // exactly the limit
    messages.emit('onEvent', new MockGPSEvent(1, 1, 10));
    expect(env.project.saveEvent).toHaveBeenCalledTimes(1);

    // under the limit
    messages.emit('onEvent', new MockGPSEvent(1, 1, 9));
    expect(env.project.saveEvent).toHaveBeenCalledTimes(2);
  })
})