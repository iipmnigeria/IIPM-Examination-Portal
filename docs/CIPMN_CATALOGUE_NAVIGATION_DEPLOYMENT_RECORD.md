# CIPMN Catalogue Navigation Production Deployment Record

## Deployment status

The candidate catalogue navigation update was deployed successfully to GitHub Pages on 26 July 2026.

- Approved application source: `83cbb43d83cdac2178a9a8d8886afca37d59c169`
- Protected deployment run: `30210259304`
- Production URL: `https://iipmnigeria.github.io/IIPM-Examination-Portal/`
- Verified compiled/live manifest SHA-256: `773cd8a08f929957d1e4a8c84dccbc2b87e61f92c7815cc2f3de9d3520fddc52`
- Verified marker asset count: 1

## Live candidate navigation

1. **IIPM Specialist Certification Catalogue**
2. **CIPMN Professional Licensing Mock Examinations**
3. **Academic Gradebook & Credentials**

All examinations returned under programme code `CIPMN-MOCK`, with a title-based fallback for `CIPMN-MOD-`, are displayed only inside the CIPMN Professional Licensing Mock Examinations section. Other examinations remain in the IIPM Specialist Certification Catalogue.

The production monitor confirmed that the live JavaScript asset manifest exactly matched the approved compiled manifest and contained all three navigation labels and the `CIPMN-MOCK` routing marker.

After successful verification, the one-time deployment workflow, deployment monitor and trigger file were removed from the active `main` branch. Their history and evidence remain available for audit purposes.
