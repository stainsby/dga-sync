# dga-sync README

## Sync data.gov.au datsets easily

The Australian government's data.gov.au website references a growing
abundance of public and open data government data resources - more
than 3700 datasets at the time of writing. While in some cases, data.gov.au
provides an API to access a dataset, it doesn't always. For this reason and
others, there are often advantages to downloading the data for local use or
to re-package it. The dga-sync utility eases the task of synchronising 
that data to a local file system.

The  dga-sync utility uses the JSON metadata stored on data.gov.au for
each dataset to ensure that data files are only downloaded if they are 
newer than what has previously been downloaded. A local copy of the metadata 
is also stored.
