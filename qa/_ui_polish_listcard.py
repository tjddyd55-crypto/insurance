from pathlib import Path

# --- CustomerListCard: remove duplicate name from expanded toolbar; keep actions ---
path = Path(r"C:\workspace\insurance-prod-push\src\features\customers\components\CustomerListCard.tsx")
text = path.read_text(encoding="utf-8")
old = '''                <div
                  className={`customer-detail-toolbar customer-card-expanded-header${
                    isMobile ? ' customer-detail-toolbar--mobile-actions' : ''
                  }`}
                >
                  <div className="customer-detail-toolbar__title customer-card-expanded-header__name">
                    {c.name}
                  </div>
                  <div
                    className={`customer-detail-action-bar${
                      isEditingThisCard
                        ? isMobile
                          ? ' customer-detail-action-bar--mobile-save-cancel-row'
                          : ' customer-detail-action-bar--pc-save-cancel-row'
                        : isMobile
                          ? ' customer-detail-action-bar--edit-delete-row'
                          : ''
                    }`}
                  >'''

new = '''                <div
                  className={`customer-detail-toolbar customer-card-expanded-header customer-detail-toolbar--actions-only${
                    isMobile ? ' customer-detail-toolbar--mobile-actions' : ''
                  }`}
                >
                  <div
                    className={`customer-detail-action-bar${
                      isEditingThisCard
                        ? isMobile
                          ? ' customer-detail-action-bar--mobile-save-cancel-row'
                          : ' customer-detail-action-bar--pc-save-cancel-row'
                        : isMobile
                          ? ' customer-detail-action-bar--edit-delete-row'
                          : ''
                    }`}
                  >'''

if old not in text:
    raise SystemExit('toolbar block not found')
text = text.replace(old, new)
path.write_text(text, encoding='utf-8')
print('list card toolbar ok')

# --- Fire location edit card: ensure full-width field rhythm ---
card = Path(r"C:\workspace\insurance-prod-push\src\features\customers\components\CustomerFireInsuranceLocationEditCard.tsx")
card_text = card.read_text(encoding='utf-8')
# already has good structure; ensure class names for CSS hooks are present
assert 'customer-fire-location-edit-card__header' in card_text
print('fire card structure ok')
