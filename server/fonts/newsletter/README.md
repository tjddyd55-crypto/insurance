NotoSansKR-Regular-glyf.ttf: server/fonts/NotoSansKR-Regular.otf (SIL OFL 1.1, see ../OFL.txt) 의 CFF 아웃라인을
TrueType(glyf) 아웃라인으로 변환한 파일. pdf-lib 의 CFF subset 임베드가 한글 글리프를 깨뜨리는 문제 때문에
소식지 → A4 PDF 변환에서 subset 임베드용으로만 사용한다 (파일 크기 절감). 기존 동의서 렌더러는 영향 없음.

NotoSansKR-Regular-compact.ttf: 위 glyf 파일을 `scripts/build-newsletter-font-subset.sh` (fontTools pyftsubset) 로
`compact-unicodes.txt` 범위(ASCII, KS X 1001 비한자 전체: 완성형 한글 2,350자·자모·기호, ₩ “”‘’ … ①-⑳ 등)만 남기고
GSUB/GPOS/GDEF·힌팅을 제거한 경량 폰트(약 485KB, PDF 임베드 시 압축 약 240KB).
소식지 A4 PDF 는 이 폰트를 subset:false + features{calt:false, locl:false} 로 임베드한다
(fontkit 런타임 subset 의 glyf 손상, calt/locl 대체 글리프의 /W 폭 누락 문제 회피).
라이선스: SIL Open Font License 1.1 (../OFL.txt). OFL 에 따른 수정 버전이며 Reserved Font Name 은 없다.
