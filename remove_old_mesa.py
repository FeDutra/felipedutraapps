with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "{/* Mesa Panel (Split Screen) */}" in line and i < 4100:
        skip = True
    if skip and "</div>" in line and "}" in lines[i+1] if i+1 < len(lines) else False:
        # Wait, simple line removal: I know exactly the lines!
        pass

# Actually, I'll just remove lines 4044 to 4059 using sed!
