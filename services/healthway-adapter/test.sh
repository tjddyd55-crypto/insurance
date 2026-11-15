#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
sdk_dir="${HEALTHWAY_SDK_DIR:-/workspace/t746-work/sdk}"
if [ ! -d "$sdk_dir/SampleTestResponseData" ] && [ ! -d sample-data ]; then
  echo 'SKIP: official SDK/samples absent; set HEALTHWAY_SDK_DIR'; exit 0
fi
./build.sh
jdk_dir="${JAVA_HOME:-/workspace/tools/jdk17}"
"$jdk_dir/bin/javac" -encoding UTF-8 -cp 'lib/*:build/classes' -d build/classes $(find test -name '*.java')
exec "$jdk_dir/bin/java" -cp 'runtime:lib/*:build/classes' onefc.healthway.AdapterTest
