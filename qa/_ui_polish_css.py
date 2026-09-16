from pathlib import Path

css_path = Path(r"C:\workspace\insurance-prod-push\src\index.css")
text = css_path.read_text(encoding="utf-8")

fire_css = '''
/* 화재보험 소재지 편집 — 섹션 타이틀 + 데이터 박스 리듬 */
.customer-fire-locations-editor__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.customer-fire-locations-editor__add {
  display: flex;
  width: 100%;
  margin-top: 10px;
  justify-content: center;
  white-space: nowrap;
}

.customer-fire-location-edit-card {
  margin: 0;
  padding: 12px;
  border: 1px solid var(--border-default, var(--border-muted));
  border-radius: 10px;
  background: var(--bg-elevated, transparent);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  box-sizing: border-box;
}

.customer-fire-location-edit-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.customer-fire-location-edit-card__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-main);
  white-space: nowrap;
}

.customer-fire-location-edit-card__remove {
  flex-shrink: 0;
  white-space: nowrap;
}

.customer-fire-location-edit-card .field,
.customer-fire-location-edit-card .address-search-field,
.customer-fire-location-edit-card .field__control {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.customer-form-section--grid-full .customer-form-section__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.customer-form-section--grid-full .field,
.customer-form-section--grid-full .field__control,
.customer-form-section--grid-full .address-search-field {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

'''

anchor = '.customer-form-section__solo .field__control {\n  width: 100%;\n  box-sizing: border-box;\n}\n'
if 'customer-fire-locations-editor__list' in text:
    print('fire css already present')
else:
    if anchor not in text:
        raise SystemExit('anchor not found')
    text = text.replace(anchor, anchor + '\n' + fire_css, 1)
    print('inserted fire css')

# Soften expand-detail card chrome / reduce nested padding
text = text.replace(
'''.customers-page .customer-expand-detail {
  margin-top: 8px;
  padding: 12px;
  border: 2px solid var(--brand-primary);
  border-radius: 12px;
  background: var(--bg-elevated);
  font-size: 0.9375rem;
  box-sizing: border-box;
  box-shadow:
    0 4px 16px color-mix(in srgb, var(--shadow-card) 80%, transparent),
    0 8px 28px color-mix(in srgb, var(--shadow-card) 50%, transparent);
''',
'''.customers-page .customer-expand-detail {
  margin-top: 6px;
  padding: 10px 10px 12px;
  border: 1px solid var(--border-default, var(--border-muted));
  border-radius: 10px;
  background: var(--bg-elevated);
  font-size: 1rem;
  box-sizing: border-box;
  box-shadow:
    0 2px 10px color-mix(in srgb, var(--shadow-card) 55%, transparent);
''')

text = text.replace(
'''.customers-page .customer-expand-card--focal .customer-expand-detail {
  border-color: var(--brand-primary);
  background: var(--bg-elevated);
  box-shadow:
    0 4px 16px color-mix(in srgb, var(--shadow-card) 80%, transparent),
    0 8px 28px color-mix(in srgb, var(--shadow-card) 50%, transparent);
}
''',
'''.customers-page .customer-expand-card--focal .customer-expand-detail {
  border-color: color-mix(in srgb, var(--brand-primary) 55%, var(--border-default, var(--border-muted)));
  background: var(--bg-elevated);
  box-shadow:
    0 2px 10px color-mix(in srgb, var(--shadow-card) 55%, transparent);
}
''')

text = text.replace(
'''.customers-page--mobile .customer-expand-detail {
  margin-top: 6px;
  padding: 10px;
}
''',
'''.customers-page--mobile .customer-expand-detail {
  margin-top: 4px;
  padding: 8px;
}
''')

# actions-only toolbar: right-align actions, no name column
actions_only = '''
.customers-page .customer-detail-toolbar--actions-only {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  grid-template-columns: none;
}

.customers-page--mobile .customer-detail-toolbar--actions-only.customer-detail-toolbar--mobile-actions {
  display: flex;
  justify-content: flex-end;
  grid-template-columns: none;
}
'''
if 'customer-detail-toolbar--actions-only' not in text:
    text = text.replace(
'''.customers-page .customer-card-expanded-header .customer-detail-action-bar {
  width: auto;
  flex-wrap: nowrap;
}
''',
'''.customers-page .customer-card-expanded-header .customer-detail-action-bar {
  width: auto;
  flex-wrap: nowrap;
}
''' + actions_only)

# bump section title one step
text = text.replace(
'''.customer-form-section__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-main);
}
''',
'''.customer-form-section__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-main);
  white-space: nowrap;
}
''')

# field grid typography bump for customers
text = text.replace(
'''.customers-page .field-grid-customers {
  gap: 10px;
  font-size: 0.9375rem;
}
''',
'''.customers-page .field-grid-customers {
  gap: 10px;
  font-size: 1rem;
}
''')

css_path.write_text(text, encoding='utf-8')
print('index.css updated', css_path.stat().st_size)
