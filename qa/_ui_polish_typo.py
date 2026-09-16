from pathlib import Path

path = Path(r"C:\workspace\insurance-prod-push\src\features\customers\customer-mobile-readability.css")
text = path.read_text(encoding="utf-8")
old = '''    --customer-mobile-font-base: 16px;
    --customer-mobile-font-small: 14px;
    --customer-mobile-font-title: 18px;
    --customer-mobile-font-subtitle: 15px;
    --customer-mobile-font-button: 14px;
    --customer-mobile-font-button-strong: 15px;'''
new = '''    --customer-mobile-font-base: 17px;
    --customer-mobile-font-small: 15px;
    --customer-mobile-font-title: 20px;
    --customer-mobile-font-subtitle: 16px;
    --customer-mobile-font-button: 15px;
    --customer-mobile-font-button-strong: 16px;'''
if old not in text:
    raise SystemExit('token block not found')
text = text.replace(old, new)

# ensure section titles don't wrap on narrow widths
extra = '''
  .customers-page--mobile .customer-form-section__title,
  .customers-page--mobile .customer-detail-read__section-title,
  .customers-page--mobile .customer-fire-location-edit-card__title,
  .mobile-root .customer-form-section__title {
    white-space: nowrap;
  }

  .customers-page--mobile .customer-fire-locations-editor__add.button,
  .customers-page--mobile .customer-detail-action-button.button {
    white-space: nowrap;
  }

  .customers-page--mobile .customer-expand-detail .field__control,
  .customers-page--mobile .customer-expand-detail input,
  .customers-page--mobile .customer-expand-detail textarea,
  .customers-page--mobile .customer-expand-detail .address-search-field {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
'''
if 'customer-fire-location-edit-card__title' not in text:
    # insert before closing of media query
    if not text.rstrip().endswith('}'):
        raise SystemExit('unexpected css ending')
    # find last closing brace of the media query
    idx = text.rfind('}')
    text = text[:idx] + extra + '\n' + text[idx:]

path.write_text(text, encoding='utf-8')
print('mobile readability ok')
