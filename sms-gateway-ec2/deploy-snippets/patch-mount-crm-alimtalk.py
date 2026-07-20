#!/usr/bin/env python3
from pathlib import Path

path = Path("index.js")
text = path.read_text(encoding="utf-8")
needle = 'app.listen(PORT, "0.0.0.0", () => {'
insert = (
    "// --- insurance CRM alimtalk relay (additive; does not touch SMS / government alimtalk) ---\n"
    'require("./crmAlimtalkRoutes").mount(app, { requireGatewayAuth });\n'
    "\n"
)
if "crmAlimtalkRoutes" in text:
    print("ALREADY_PATCHED")
    raise SystemExit(0)
if needle not in text:
    raise SystemExit("listen hook not found")
path.write_text(text.replace(needle, insert + needle, 1), encoding="utf-8")
print("PATCHED_OK")
