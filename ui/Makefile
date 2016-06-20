BROWSERIFY := ./node_modules/.bin/browserify

all: build/index.js build/index.html

build/index.js: index.js build
	${BROWSERIFY} $< -t babelify --presets es2015 --presets react -o $@

build/index.html: index.html build
	cp $< $@

build:
	mkdir -p $@
