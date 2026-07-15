import re

with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

# Make the wrapper hide if voiceMode is 'presence' or 'recording_meeting'
# Actually, the user wants the orb to be large and centered!
# The code does this:
# const presenceMode = voiceMode === 'presence';
# I can just change it to:
# const presenceMode = voiceMode === 'presence' || voiceMode === 'recording_meeting';

target = "const presenceMode = voiceMode === 'presence';"
replacement = "const presenceMode = voiceMode === 'presence' || voiceMode === 'recording_meeting';"
if target in content:
    content = content.replace(target, replacement)

# Add the red blinking REC indicator below the orb when in 'recording_meeting'
# We find where the visual elements of the orb are.
# Wait, the orb is:
# <div className={isAtelieActive ? ... : `relative w-64 h-64 ...`}
target_orb = """            {voiceMode === 'presence' && (
              <div className="absolute w-[300%] h-[300%] bg-white/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />
            )}"""
replacement_orb = """            {(voiceMode === 'presence' || voiceMode === 'recording_meeting') && (
              <div className="absolute w-[300%] h-[300%] bg-white/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />
            )}
            
            {voiceMode === 'recording_meeting' && (
              <div className="absolute -bottom-16 flex flex-col items-center gap-2 pointer-events-none">
                <div className="w-3 h-3 bg-[#b8283e] rounded-full animate-pulse shadow-[0_0_10px_rgba(184,40,62,0.8)]" />
                <span className="text-[10px] text-[#b8283e] font-mono tracking-widest animate-pulse">GRAVANDO</span>
              </div>
            )}"""

if target_orb in content:
    content = content.replace(target_orb, replacement_orb)

# Fix the button onClick
target_button = """          <button
            onClick={toggleRecordingOnce}
            className={`p-1.5 transition-all duration-300 bg-transparent border-none cursor-pointer outline-none mb-0.5 ${voiceMode === 'recording_once' ? 'opacity-100 drop-shadow-[0_0_8px_rgba(184,40,62,0.6)] animate-pulse' : 'opacity-30 hover:opacity-100'}`}
            title="Gravar Reunião"
          >
            <Circle size={10} strokeWidth={3} className={voiceMode === 'recording_once' ? "text-[#b8283e]" : "text-[#fbf9f5]"} fill={voiceMode === 'recording_once' ? "currentColor" : "none"} />
          </button>"""

replacement_button = """          <button
            onClick={toggleMeetingRecording}
            className={`p-1.5 transition-all duration-300 bg-transparent border-none cursor-pointer outline-none mb-0.5 ${voiceMode === 'recording_meeting' ? 'opacity-100 drop-shadow-[0_0_8px_rgba(184,40,62,0.6)] animate-pulse' : 'opacity-30 hover:opacity-100'}`}
            title="Gravar Reunião"
          >
            <Circle size={10} strokeWidth={3} className={voiceMode === 'recording_meeting' ? "text-[#b8283e]" : "text-[#fbf9f5]"} fill={voiceMode === 'recording_meeting' ? "currentColor" : "none"} />
          </button>"""

if target_button in content:
    content = content.replace(target_button, replacement_button)

with open('src/apps/pulso/pages/LivePage.tsx', 'w') as f:
    f.write(content)
