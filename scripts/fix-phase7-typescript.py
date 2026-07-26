from pathlib import Path

# One-time source correction derived from the captured TypeScript diagnostic.
component = Path('src/components/AiCvProfileBuilder.tsx')
text = component.read_text(encoding='utf-8')
old_import = "import { useEffect, useMemo, useState } from 'react';"
new_import = "import { useEffect, useMemo, useState, type ReactNode } from 'react';"
if old_import not in text and new_import not in text:
    raise SystemExit('Expected React import not found.')
text = text.replace(old_import, new_import, 1)
text = text.replace('React.ReactNode', 'ReactNode')
component.write_text(text, encoding='utf-8')

service = Path('src/services/aiCvProfileBuilderService.ts')
text = service.read_text(encoding='utf-8')
if 'data as CandidateCvDocument' not in text and 'data as unknown as CandidateCvDocument' not in text:
    raise SystemExit('Expected CandidateCvDocument cast not found.')
text = text.replace('data as CandidateCvDocument', 'data as unknown as CandidateCvDocument')
service.write_text(text, encoding='utf-8')
