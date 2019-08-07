#!/bin/bash

## Set the variable below to your Aria password
ARIA_RPC_SECRET="some long key"
## This is the maximum number of download jobs that will be active at a time. Note that this does not affect the number of concurrent *uploads*
MAX_CONCURRENT_DOWNLOADS=3
## The port that RPC will listen on
RPC_LISTEN_PORT=8210
aria2c --enable-rpc --rpc-listen-all=false --rpc-listen-port $RPC_LISTEN_PORT --max-concurrent-downloads=$MAX_CONCURRENT_DOWNLOADS --max-connection-per-server=10 --rpc-max-request-size=1024M --seed-time=0.01 --min-split-size=10M --follow-torrent=mem --split=10 --rpc-secret=$ARIA_RPC_SECRET --max-overall-upload-limit=1 --daemon=true
echo "Aria2c daemon started"
