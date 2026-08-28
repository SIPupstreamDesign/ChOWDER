@echo off

pushd %~dp0..
cd redis
start redis-server.exe --appendonly yes
cd ..\server
node server.js
popd