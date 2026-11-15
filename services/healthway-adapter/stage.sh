#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
sdk_dir="${HEALTHWAY_SDK_DIR:-/workspace/t746-work/sdk}"
mkdir -p lib sample-data
cp "$sdk_dir"/lib/*.jar lib/
cp "$sdk_dir"/SampleTestResponseData/*.JSON sample-data/
# Official ESI vocabulary stays outside the public repository, just like SDK samples.
python3 - "$sdk_dir/docs-txt/checkup-demand-data-ESI.txt" <<'PY'
import re,sys,json
names={}
for line in open(sys.argv[1]):
 m=re.search(r'\S+\s+(.+?)\s+(ESI\d+(?:-\d+)?)\s*$',line)
 if m:names[m[2]]=m[1].strip().lstrip('*')
json.dump(names,open('sample-data/esi-names.json','w'),ensure_ascii=False)
PY
