from pathlib import Path
path = Path(r"C:\workspace\insurance-prod-push\src\index.css")
text = path.read_text(encoding="utf-8")
old = '''.customer-fire-location-edit-card__header {
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
'''
new = '''.customer-fire-location-edit-card__header {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
  min-width: 0;
  width: 100%;
}

.customer-fire-location-edit-card__title {
  margin: 0;
  padding: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 36px;
  height: 36px;
  color: var(--text-main);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
}

.customer-fire-location-edit-card__remove {
  flex-shrink: 0;
  white-space: nowrap;
  height: 36px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}
'''
if old not in text:
    raise SystemExit('header css block not found')
path.write_text(text.replace(old, new), encoding='utf-8')
print('css fixed')
