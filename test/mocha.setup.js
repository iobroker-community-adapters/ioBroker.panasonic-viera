// Don't silently swallow unhandled rejections
process.on('unhandledRejection', error => {
  throw error;
});

// Enable the should interface with sinon
// and load chai-as-promised and sinon-chai by default
const sinonChai = require('sinon-chai');
const chaiAsPromised = require('chai-as-promised');
const {should, use} = require('chai');

should();
use(sinonChai);
use(chaiAsPromised);
