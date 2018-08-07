@echo off
pushd %~dp0

cd ..
npm install

cd standalone-electron
npm install

popd