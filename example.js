var syncer = require('./lib/index.js');
var packageId = '23218e8f-babe-4e37-81d1-5424a4d1c568'; // BBQs');

syncer.syncByPackageId(packageId, {
  idFilter: /.*\.kmz$/,
  deleteUnlisted: true
});
