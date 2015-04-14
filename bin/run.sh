#!/bin/sh

cd `dirname $0`/../redis
open ./redis-server

cd ../server
node server.js


