const read = require('fs').readFileSync;
const join = require('path').join;

function loadScript() {
  // import global script
  const script = read(join(__dirname, '..', 'dist', 'bundle.js')).toString('utf-8');
  eval(script);
}

describe("onInit", () => {
  it('loads the script correctly', () => {
    loadScript();
    messages.emit('onInit');
  })
});
