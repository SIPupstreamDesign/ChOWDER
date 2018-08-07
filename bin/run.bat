@echo off

pushd %~dp0..
cd redis
start redis-server.exe
cd ..\server
node server.js
popd