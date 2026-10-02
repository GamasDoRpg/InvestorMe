# Company logos

These SVGs identify the nine companies in the initial reference catalog. They are bundled locally, work offline, keep their original colors in both themes and do not require an API key or runtime image request.

Retrieved on 2026-10-02 from the public brapi logo CDN:

| File | Company | Source |
| --- | --- | --- |
| `petrobras.svg` | Petrobras | https://icons.brapi.dev/icons/PETR4.svg |
| `vale.svg` | Vale | https://icons.brapi.dev/icons/VALE3.svg |
| `weg.svg` | WEG | https://icons.brapi.dev/icons/WEGE3.svg |
| `itau.svg` | Itaú Unibanco | https://icons.brapi.dev/icons/ITUB4.svg |
| `bradesco.svg` | Bradesco | https://icons.brapi.dev/icons/BBDC4.svg |
| `magalu.svg` | Magazine Luiza | https://icons.brapi.dev/icons/MGLU3.svg |
| `apple.svg` | Apple | https://icons.brapi.dev/icons/AAPL.svg |
| `microsoft.svg` | Microsoft | https://icons.brapi.dev/icons/MSFT.svg |
| `nvidia.svg` | NVIDIA | https://icons.brapi.dev/icons/NVDC34.svg |

NVDC34 represents the same company as NVDA; only the corporate mark is reused, not the instrument identity, currency or quote. The source SVG bytes are retained. Logos/trademarks belong to their respective owners and identify the issuer; their inclusion implies no endorsement or ownership by InvestorMe.

`ui/asset-logos.mjs` uses explicit exchange/symbol mappings, not ticker-prefix guessing. Assets discovered through provider search without a bundled mapping show their ticker. Missing/undecodable files also fall back to the ticker. Add a verified source and mapping when expanding coverage; do not invent marks or inject untrusted remote SVG into HTML.

SVGs are used through local `<img>` elements, not inline markup. The renderer CSP remains unchanged. Files were inspected for script, event handlers, embedded images, external references and active SVG elements before inclusion.
