with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "Floating button to return to bottom" in line:
        idx = i
        break

# idx points to "          {/* Floating button..."
# We expect:
# idx + 0:           {/* Floating button...
# idx + 1:           {showScrollButton && (
# idx + 2:             <button
# idx + 3:               onClick=...
# ...
# idx + 8:           )}
# idx + 9:         </div>

# We will inject the closing div and MesaPanel and )} right after `</div>` at idx + 9.
target_idx = idx + 9
while "</div>" not in lines[target_idx]:
    target_idx += 1

print(f"Found </div> at {target_idx}")
# So at target_idx we have `        </div>`
# Then we should have the MesaPanel, the closing div for OuterFlexRow, and `)}`

lines.insert(target_idx + 1, """
        {/* Mesa Panel (Split Screen) */}
        {isMesaOpen && activeMesaArtifact && (
          <div 
            className={`hidden md:block w-1/2 relative transition-all duration-300 ml-4 bg-black/60 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl overflow-hidden`}
            style={{ height: chatHeight }}
          >
            <MesaPanel
              isOpen={isMesaOpen}
              onClose={() => setIsMesaOpen(false)}
              artifact={activeMesaArtifact}
              onSave={async (id, content) => {
                setActiveMesaArtifact(prev => prev ? { ...prev, content } : null);
              }}
            />
          </div>
        )}
      </div>
      )}
""")

# Now we need to remove the dangling `)}` that I added manually earlier.
# It should be around target_idx + 3. Let's just remove any `)}` lines between target_idx+2 and target_idx+5.
for j in range(target_idx + 2, target_idx + 15):
    if j < len(lines) and ")}" in lines[j] and len(lines[j].strip()) == 2:
        print(f"Removing redundant '}})' at {j}")
        lines[j] = ""

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.writelines(lines)
