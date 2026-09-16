from pathlib import Path
p = Path(r"C:\workspace\insurance-prod-push\qa\uiPolish1342.mjs")
t = p.read_text(encoding='utf-8')
old = """return { sameRow: Math.abs(tr.top - br.top) < 12, titleLeftOfBtn: tr.left < br.left }"""
new = """const tc = (tr.top + tr.bottom) / 2; const bc = (br.top + br.bottom) / 2; return { sameRow: Math.abs(tc - bc) < 14, titleLeftOfBtn: tr.left < br.left, delta: Math.abs(tc - bc) }"""
if old not in t:
    raise SystemExit('check not found')
p.write_text(t.replace(old, new), encoding='utf-8')
print('qa check updated')
