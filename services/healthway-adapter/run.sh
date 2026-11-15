#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[ -f build/healthway-adapter.jar ] || ./build.sh
jdk_dir="${JAVA_HOME:-/workspace/tools/jdk17}"
exec "$jdk_dir/bin/java" -Dorg.slf4j.simpleLogger.defaultLogLevel=off -jar build/healthway-adapter.jar
