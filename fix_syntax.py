with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    lines = f.readlines()

# find the floating button block
for i, line in enumerate(lines):
    if "Floating button to return to bottom" in line:
        scroll_btn_idx = i
        break

# The block is:
#           {/* Floating button to return to bottom */}
#           {showScrollButton && (
#             <button ... > ... </button>
#           )}
#         </div>

# We need to add `)}` after `</div>`
# In the current file, line 4031 is `        </div>`.
# Let's just insert `      )}` at line 4032.

lines.insert(4032, "      )}\n")

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.writelines(lines)
