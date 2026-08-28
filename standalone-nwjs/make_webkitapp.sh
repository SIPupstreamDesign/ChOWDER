rm -f nwjs/package.nw
zip -u nwjs/package.nw index.html
zip -u nwjs/package.nw package.json
cp -f conf.json nwjs/
cat nwjs/nw nwjs/package.nw > nwjs/standalone_display
chmod +x ./nwjs/standalone_display
./nwjs/standalone_display