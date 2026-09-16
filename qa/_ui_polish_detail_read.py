from pathlib import Path
path = Path(r"C:\workspace\insurance-prod-push\src\index.css")
text = path.read_text(encoding="utf-8")
text = text.replace(
'''.customer-detail-read__info-label {
  font-weight: 600;
  color: var(--text-main);
}

.customer-detail-read__info-value {
  color: var(--text-main);
  overflow-wrap: anywhere;
  word-break: break-word;
}
''',
'''.customer-detail-read__info-label {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--text-main);
}

.customer-detail-read__info-value {
  font-size: 1rem;
  color: var(--text-main);
  overflow-wrap: anywhere;
  word-break: break-word;
}
''')
text = text.replace(
'''.customer-detail-read__section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-main);
}
''',
'''.customer-detail-read__section-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-main);
  white-space: nowrap;
}
''')
# soften nested section header indent
text = text.replace(
'''.customer-detail-read__section-header {
  margin-top: 1.125rem;
  margin-bottom: 0.5rem;
  padding-left: 0.65rem;
  border-left: 2px solid color-mix(in srgb, var(--text-main) 32%, transparent);
}
''',
'''.customer-detail-read__section-header {
  margin-top: 0.85rem;
  margin-bottom: 0.4rem;
  padding-left: 0.5rem;
  border-left: 2px solid color-mix(in srgb, var(--text-main) 28%, transparent);
}
''')
path.write_text(text, encoding='utf-8')
print('detail-read typography ok')
