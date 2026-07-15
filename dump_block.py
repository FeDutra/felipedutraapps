with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    lines = f.readlines()
with open('scratch_block.txt', 'w') as f:
    f.writelines(lines[3740:4040])
