import * as MonoUtils from "@fermuch/monoutils";

// based on settingsSchema @ package.json
type Config = {};
const conf = new MonoUtils.config.Config<Config>();

messages.on('onInit', function() {
  platform.log('GPS script started');
});