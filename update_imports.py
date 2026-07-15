with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

if "import { useMeetingRecorder }" not in content:
    target = "import { getApp } from 'firebase/app';"
    replacement = "import { getApp } from 'firebase/app';\nimport { useMeetingRecorder } from '../hooks/useMeetingRecorder';"
    content = content.replace(target, replacement)
    with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
        f.write(content)
