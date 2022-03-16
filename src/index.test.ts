import * as MonoUtils from '@fermuch/monoutils';
const read = require('fs').readFileSync;
const join = require('path').join;

function loadScript() {
  // import global script
  const script = read(join(__dirname, '..', 'dist', 'bundle.js')).toString('utf-8');
  eval(script);
}

describe("onInit", () => {
  afterEach(() => {
    // clean listeners
    messages.removeAllListeners();
  });

  it('loads the script correctly', () => {
    loadScript();
    messages.emit('onInit');
  })
  xit('requests for GPS to be enabled', () => {});
  xit('sets GPS configuration', () => {});
  xit('emits custom-gps if saveGPS is enabled', () => {});
  xit('emits GeofenceEvent when entering geofence if enableGeofences is enabled', () => {});
  xit('emits GeofenceEvent when exiting geofence if enableGeofences is enabled', () => {});
  xit('emits SpeedExcessEvent when speed is over the limit if enableSpeedExcess is enabled', () => {});
});