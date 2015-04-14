@echo off

cd %~dp0..\redis
start redis-server.exe

cd ..\server
node server.js
