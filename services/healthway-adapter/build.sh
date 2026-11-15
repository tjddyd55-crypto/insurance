#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f lib/platform-sdk-0.2.8-SNAPSHOT.jar ]; then ./stage.sh; fi
jdk_dir="${JAVA_HOME:-/workspace/tools/jdk17}"
mkdir -p build/classes runtime
"$jdk_dir/bin/javac" -encoding UTF-8 --release 17 -cp 'lib/*' -d build/classes $(find src -name '*.java')
printf 'Main-Class: onefc.healthway.Main\nClass-Path: ../runtime/ ../lib/platform-sdk-0.2.8-SNAPSHOT.jar ../lib/fhir-converter-sdk-0.0.1-SNAPSHOT.jar ../lib/jackson-databind-2.14.0.jar\n\n' > build/MANIFEST.MF
"$jdk_dir/bin/jar" cfm build/healthway-adapter.jar build/MANIFEST.MF -C build/classes .
