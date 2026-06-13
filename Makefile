WEB_DIR := web

LAUNCHER_DIR := launcher

.PHONY: all install audit build test preview launcher-build clean

all: build launcher-build

install:
	npm --prefix ${WEB_DIR} install

audit:
	node tools/catalog-audit.mjs

build: audit
	npm --prefix ${WEB_DIR} run build

test:
	npm --prefix ${WEB_DIR} test
	npm --prefix ${WEB_DIR} audit --audit-level=moderate

preview: build
	npm --prefix ${WEB_DIR} run preview

launcher-build:
	mkdir -p ${LAUNCHER_DIR}/bin
	cd ${LAUNCHER_DIR} && go build -o bin/rat-launcher .

clean:
	rm -rf ${WEB_DIR}/dist ${LAUNCHER_DIR}/bin
