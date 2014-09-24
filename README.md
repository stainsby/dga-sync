# dga-sync README


## Sync data.gov.au datsets easily

The Australian government's data.gov.au website references a growing
abundance of public and open data government data resources - more
than 3700 datasets at the time of writing. While in some cases, data.gov.au
provides an API to access a dataset, it doesn't always. For this reason and
others, there are often advantages in downloading the data for local use or
to re-package it. The dga-sync utility eases the task of synchronising 
that data to a local file system.

dga-sync uses the JSON metadata stored on data.gov.au for
each dataset to ensure that data files are only downloaded if they are 
newer than what has previously been downloaded. A local copy of the metadata 
is also stored.


## Getting started

```
npm install dga-sync
```

### Simple usage

For each data.gov.au dataset, there is a JSON metadata file (accessed from
the JSON button on the web page) that leads to a URL of the following form:

```
http://data.gov.au/api/3/action/package_show?id=23218e8f-babe-4e37-81d1-5424a4d1c568
```
Use the `id` parameter to identify the package to sync:
```
var sync = require('dga-sync');
sync.syncByPackageId('23218e8f-babe-4e37-81d1-5424a4d1c568');
```

This is what the console output looks like (actual output is colourised where
supported):
```
fetching metadata for package ID: 23218e8f-babe-4e37-81d1-5424a4d1c568
found: "Public Barbeques"
reply lists 5 resources:
   barbeque.kmz "2014 Public Barbeques" @ 2014-09-16T02:05:54.523Z
   wfs?request=GetFeature&typeName=23218e8f_babe_4e37_81d1_5424a4d1c568&outputFormat=csv "Public Barbeques CSV" @ 2014-09-16T02:05:54.523Z
   wfs?request=GetFeature&typeName=23218e8f_babe_4e37_81d1_5424a4d1c568&outputFormat=json "Public Barbeques GeoJSON" @ 2014-09-16T02:05:54.523Z
   wms?request=GetCapabilities "Public Barbeques - Preview this Dataset (WMS)" @ 2014-09-16T02:05:54.523Z
   wfs?request=GetCapabilities "Public Barbeques Web Feature Service API Link" @ 2014-09-16T02:05:54.523Z
preparing to download barbeque.kmz
preparing to download wfs?request=GetFeature&typeName=23218e8f_babe_4e37_81d1_5424a4d1c568&outputFormat=csv
preparing to download wfs?request=GetFeature&typeName=23218e8f_babe_4e37_81d1_5424a4d1c568&outputFormat=json
preparing to download wms?request=GetCapabilities
preparing to download wfs?request=GetCapabilities
downloading completed
  .. moving data/._DGA_DOWNLOAD_barbeque.kmz to data/barbeque.kmz
  .. moving data/._DGA_DOWNLOAD_wfs?request=GetFeature&typeName=23218e8f_babe_4e37_81d1_5424a4d1c568&outputFormat=csv to data/wfs?request=GetFeature&typeName=23218e8f_babe_4e37_81d1_5424a4d1c568&outputFormat=csv
  .. moving data/._DGA_DOWNLOAD_wfs?request=GetFeature&typeName=23218e8f_babe_4e37_81d1_5424a4d1c568&outputFormat=json to data/wfs?request=GetFeature&typeName=23218e8f_babe_4e37_81d1_5424a4d1c568&outputFormat=json
  .. moving data/._DGA_DOWNLOAD_wms?request=GetCapabilities to data/wms?request=GetCapabilities
  .. moving data/._DGA_DOWNLOAD_wfs?request=GetCapabilities to data/wfs?request=GetCapabilities
writing download metadata to: data/._METADATA_.json
```

At this point, a directory called `data` under the current working directory
will have be created and will contain the downloaded resources plus a metadata
file created by dga-sync:
```
$ ls -lhA data
total 744K
-rw-r--r-- 1 sam sam  44K Sep 24 11:14 barbeque.kmz
-rw-r--r-- 1 sam sam 6.0K Sep 24 11:15 ._METADATA_.json
-rw-r--r-- 1 sam sam  72K Sep 24 11:15 wfs?request=GetCapabilities
-rw-r--r-- 1 sam sam  95K Sep 24 11:14 wfs?request=GetFeature&typeName=23218e8f_babe_4e37_81d1_5424a4d1c568&outputFormat=csv
-rw-r--r-- 1 sam sam 384K Sep 24 11:14 wfs?request=GetFeature&typeName=23218e8f_babe_4e37_81d1_5424a4d1c568&outputFormat=json
-rw-r--r-- 1 sam sam 139K Sep 24 11:14 wms?request=GetCapabilities
```

The metadata file will ensurethat next time we check, only newer resources
than we already have will be donwloaded, saving on bandwidth.


### Limiting what gets downloaded

As you can see from above, all resources are downloaded by default. This can
be changed by adding an `idFilter` regex option. So if we only want the KMZ
files in our example:
```
sync.syncByPackageId(
  '23218e8f-babe-4e37-81d1-5424a4d1c568',
  {
    idFilter: /.*\.kmz$/,
    deleteUnlisted: true
  }
);
```
The use of `deleteUnlisted` is optional, and is tells dga-sync to delete 
previously downloaded files now excluded by the filter. The contents of
`data` is now:
```
$ ls -lhA data
total 48K
-rw-r--r-- 1 sam sam  44K Sep 24 11:14 barbeque.kmz
-rw-r--r-- 1 sam sam 1.4K Sep 24 11:26 ._METADATA_.json
```

## API

There is currently only one method:

**syncByPackageId(packageId, options, andThen)**

`packageId` - the ID of the package'

`options` - an object with the following options:
  
  - `idFieldName` - specifies the field in a resource to use as the resource 
    ID [default: `'url'`]
    
  - `idCanonicaliser` - a function that takes the resource ID (according to the 
    `idFieldName` option) and creates a canonical ID for future comparison 
    in later sync operations (this is useful for file 
    dumps that are revised by adding new dumps instead of updating the old 
    resource id) [default: split the ID at '/'s and use use the last part: 
    this assumes that `idFieldName` is the default value of `'url'`]
    
  - `idFilter` - applied to the (canonicalised) resource ID to choose which 
    resources will be synced [default: `undefined` - that is, accept all IDs]
  
  - `dataDestination` - the directory to store the downloaded resources in
  
  - `deleteUnlisted` - boolean: `true` means delete extraneous files in the 
    destination directory that don't correspond to a resource IDs in the 
    filtered list [default: `false`]

`andThen(err)` - optional callback, where `err` is any error encountered that
  prevented successful completion

