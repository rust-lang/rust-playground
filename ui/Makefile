BROWSERIFY := ./node_modules/.bin/watchify

all: build/index.js

.PHONY: build/index.js
build/index.js: index.js
	${BROWSERIFY} $< -t babelify --presets es2015 --presets react -o $@

.DELETE_ON_ERROR:
