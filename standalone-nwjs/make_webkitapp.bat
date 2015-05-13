@ECHO OFF
del /Q nwjs\package.nw
7z a -tzip nwjs\package.nw index.html
7z a -tzip nwjs\package.nw package.json
copy /Y conf.json nwjs\
copy /b nwjs\nw.exe+nwjs\package.nw nwjs\standalone_display.exe
start nwjs\standalone_display.exe
