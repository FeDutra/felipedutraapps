with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

target = "export type VoiceMode = 'off' | 'recording_once' | 'presence';"
replacement = "export type VoiceMode = 'off' | 'recording_once' | 'presence' | 'recording_meeting';"
if target in content:
    content = content.replace(target, replacement)
    
target2 = "originMode?: 'text' | 'recording_once' | 'presence'"
replacement2 = "originMode?: 'text' | 'recording_once' | 'presence' | 'recording_meeting'"
if target2 in content:
    content = content.replace(target2, replacement2)
    
with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
