#!/bin/sh

ORIGIN=`pwd`

cd `dirname $0`/..

# port:80のプログラム、ChOWDERサーバー`node server.js`を終了する
lsof -i :80 -t | xargs kill -9
# port:6379のプログラム、redisサーバーを終了する
lsof -i :6379 -t | xargs kill -9

cd $ORIGIN
