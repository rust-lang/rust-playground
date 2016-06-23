BROWSERIFY := ./node_modules/.bin/browserify
WATCHIFY := ./node_modules/.bin/watchify

all: build/index.js

.PHONY: build/index.js
build/index.js: index.js
	${WATCHIFY} $< -t babelify --presets es2015 --presets react -o $@

.PHONY: build/index.js.gz
build/index.js.gz: index.js
	NODE_ENV=production ${BROWSERIFY} $< -t babelify -t envify -g uglifyify --presets es2015 --presets react | gzip -9 > $@

.DELETE_ON_ERROR:
