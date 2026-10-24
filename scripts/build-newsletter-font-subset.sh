#!/usr/bin/env bash
# 소식지 A4 PDF 용 경량 한글 폰트 재생성 스크립트 (fontTools/pyftsubset 필요: pip install fonttools).
# 런타임에는 실행되지 않는다. 결과물(NotoSansKR-Regular-compact.ttf)을 커밋한다.
# 문자 범위: server/fonts/newsletter/compact-unicodes.txt
#   ASCII, KS X 1001 비한자 전체(기호·완성형 한글 2,350자·자모), ₩ “”‘’ … ※ ○●■□▶ ①-⑳ 등.
# GSUB/GPOS/GDEF 등 레이아웃 테이블과 힌팅을 제거해 glyf 만 남긴다 (pdf-lib subset:false 임베드용).
set -euo pipefail
cd "$(dirname "$0")/.."
D=server/fonts/newsletter
pyftsubset "$D/NotoSansKR-Regular-glyf.ttf" \
  --unicodes-file="$D/compact-unicodes.txt" \
  --output-file="$D/NotoSansKR-Regular-compact.ttf" \
  --layout-features='' --no-hinting \
  --drop-tables+=GSUB,GPOS,GDEF,DSIG,vhea,vmtx,VORG \
  --name-IDs='*' --notdef-outline --glyph-names=false
ls -l "$D/NotoSansKR-Regular-compact.ttf"
