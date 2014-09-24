'use strict';
/* jshint node: true */

var config = require('../config');
var path = require('path');
var fs = require('fs');
var _ = require('lodash');
var http = require('http');
var C = require('chalk');
var Download = require('download');


function downloadResources(resourcesToDownload, options, andThen) {
  
  var ids = Object.keys(resourcesToDownload);
  if (!ids.length) {
    console.log(C.red('no files to download - nothing to do!'));
    return;
  }
  
  var destination = options.dataDestination;
  var metadataFile = path.join(destination, options.metadataFile);
  var tmpPrefix = options.temporaryPrefix;
  
  var oldMetadata;
  if (fs.existsSync(metadataFile)) {
    console.log('reading existing download metadata from:', metadataFile);
    var str = fs.readFileSync(metadataFile, {encoding: 'utf8'});
    oldMetadata = JSON.parse(str);
    console.log('existing downloads:', Object.keys(oldMetadata).join(', '));
  }
  var download = new Download({});
  var downloadedIds = [];
  var downloadedResources = {};
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var entry = resourcesToDownload[id];
    var timestamp = entry.timestamp;
    var resource = entry.resource;
    var url = resource.url;
    if (oldMetadata) {
      var meta = oldMetadata[id];
      if (meta) {
        var oldTimestamp = meta.timestamp;
        if (timestamp <= oldTimestamp) {
          console.log(C.grey(id + ' is not newer than existing download - skipping'));
          continue;
        }
      }
    }
    console.log('preparing to download', id);
    download = download.get({url: url, name: tmpPrefix + id}, 'data');
    downloadedIds.push(id);
    downloadedResources[id] = entry;
  } // end of for loop
  
  download.run(function(err) {
    if (err) {
        console.log(C.red('ERROR:' + err));
        return andThen(err);
    }
    if (downloadedIds.length) {
      console.log(C.green('downloading completed'));
      for (var i = 0; i < downloadedIds.length; i++) {
        var downloadedId = downloadedIds[i];
        var fileFrom = path.join(destination, tmpPrefix + downloadedId);
        var fileTo = path.join(destination, downloadedId);
        console.log('  .. moving', fileFrom, 'to', fileTo);
        fs.renameSync(fileFrom, fileTo);
      }
      console.log('writing download metadata to:', metadataFile);
    } else {
      console.log(C.green('nothing to download'));
    }
    fs.writeFileSync(metadataFile, JSON.stringify(resourcesToDownload, true, 2));
    return andThen();
  });
}

/*
  A utility to sync resources from data.gov.au (called DGA herein) using 
  their JSON metadata.
  
  packageId - the ID of the package: generally the URL will look like this:
    http://data.gov.au/api/3/action/package_show?id=5bd7fcab-e315-42cb-8daf-50b7efc2027e
    where the package ID in this case is '5bd7fcab-e315-42cb-8daf-50b7efc2027e'
  
  options - an object with the following options:
    
    - idFieldName - specifies the field in a resource to use as the resource 
      ID [default: 'url']
      
    - idCanonicaliser - a function that takes the resource ID (according to the 
      'idFieldName' option) and creates a canonical ID for future comparison 
      in later sync operations (this is useful for file 
      dumps that are revised by adding new dumps instead of updating the old 
      resource id) [default: split the ID at '/'s and use use the last part: 
      this assumes that idFieldName is the default value of 'url']
      
    - idFilter - applied to the (canonicalised) resource ID to choose which 
      resources will be synced [default: undefined => accept all IDs]
    
    - dataDestination - the directory to store the downloads in
    
    - deleteUnlisted - boolean: true means delete extraneous files in the 
      destination directory that don't correspond to a resource IDs in the 
      filtered list [default: false]
  
  andThen(err) - optional callback
*/
 
function syncByPackageId(packageId, options, andThen) {
  
  var resourcesToDownload = {};
  andThen = andThen || function(err) { if (err) throw err; };
  
  function addDownload(id, resource) {
    // if an entry already exists for the same ID, only add the new resource
    // to the download list if it is newer
    var priorEntry = resourcesToDownload[id];
    var ts = new Date(resource.revision_timestamp + 'Z');
    var timestamp = ts.getTime();
    if (priorEntry) {
      var priorEntryTimestamp = priorEntry.timestamp;
      console.log(C.yellow('      warning: duplicate entry with same ID'));
      if (priorEntry.timestamp > timestamp) {
        console.log(C.yellow('      rejecting this older resource'));
        return; // don't add older resource
      }
    }
    resourcesToDownload[id] = {
      timestamp: timestamp,
      resource: resource
    };
  }
  
  var url = config.apiBaseUrl + '/action/package_show?id=' + packageId;
  console.log('fetching metadata for package ID:',  C.bold(packageId));
  var jsonStr = '';
  options = _.defaults(options || {}, config.defaults.fetch);
  var dowloadOptions = _.defaults(options, config.defaults.repo);
  var idFieldName = options.idFieldName;
  var idCanonicaliser = options.idCanonicaliser || (function(id) {
    return id.split('/').pop();
  });
  var req = http.get(
    url,
    function(res) {
      var status = res.statusCode;
      if (Math.floor(status/100) !== 2) {
        return andThen(Error('got HTTP status', status));
      }
      res.setEncoding('utf8');
      res.on('data', function(data) {
        jsonStr = jsonStr + data;
      });
      res.on('end', function() {
        var reply = JSON.parse(jsonStr);
        var apiStatus = reply.success;
        if (apiStatus !== true) {
          console.log(C.red('ERROR:' + apiStatus));
          return andThen(Error('API said:', apiStatus));
        }
        var result = reply.result;
        var resources = result.resources;
        var resourceCount = resources.length;
        console.log('found:', C.bold('"' + result.title + '"'));
        console.log('reply lists', resourceCount, 'resources:');
        for (var i = 0; i < resourceCount; i++) {
          var resource = resources[i];
          var id = resource[idFieldName];
          var canonicalFn = idCanonicaliser;
          if (canonicalFn) {
            id = canonicalFn(id);
          }
          var tsDate = new Date(resource.revision_timestamp + 'Z');
          var timestamp = tsDate.getTime();
          
          console.log(
            C.blue.bold('  '), C.blue.bold(id),
            C.blue.bold('"' + resource.name + '"'),
            ('@ ' + tsDate.toISOString())
          );
          
          var filterRegex = options.idFilter;
          if (filterRegex) {
            if (filterRegex.test(id)) {
              console.log(C.green('      [+] accepted by ID filter'));
            } else {
              console.log(C.grey('      [-] rejected by ID filter'));
              continue;
            }
          }
          
          addDownload(id, resource);
        } // end of for loop
        downloadResources(
          resourcesToDownload,
          dowloadOptions,
          function(err) {
            if (err) {
              return andThen(err);
            } else {
              if (options.deleteUnlisted) {
                var dest = dowloadOptions.dataDestination;
                var filesToKeep = Object.keys(resourcesToDownload);
                filesToKeep.unshift(options.metadataFile);
                console.log('cleaning up ..');
                var listing = fs.readdirSync(dest);
                var toDelete = _.difference(listing, filesToKeep);
                toDelete.forEach(function(deleteFile) {
                  deleteFile = path.join(dest, deleteFile);
                  console.log(C.yellow('  DELETING extraneous file: ' + deleteFile));
                  fs.unlinkSync(deleteFile);
                });
                if (!toDelete.length) {
                  console.log(C.green('nothing to clean up'));
                } else {
                  console.log(C.green('cleaning up finished'));
                }
              }
              andThen(null);
            }
          }
        );
      });
    }
  );
  req.on('error', function(err) {
    console.log(C.red('ERROR:' + err));
    return andThen(err);
  });
}
 
module.exports = {
 syncByPackageId: syncByPackageId
};
