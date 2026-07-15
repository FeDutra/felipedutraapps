import re

with open('src/apps/pulso/pages/LivePage.tsx', 'r') as f:
    content = f.read()

start_pattern = r"\{\(\!isAtelieActive\s*\|\|\s*showAtelieChatHistory\)\s*\&\&\s*\("
match = re.search(start_pattern, content)
if match:
    start_idx = match.start()
    depth = 0
    end_idx = -1
    in_string = False
    string_char = ''

    for i in range(start_idx, len(content)):
        c = content[i]
        if in_string:
            if c == string_char and content[i-1] != '\\':
                in_string = False
        else:
            if c in ["'", '"', '`']:
                in_string = True
                string_char = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    end_idx = i
                    break
    
    print("End idx:", end_idx)
    if end_idx != -1:
        block = content[start_idx:end_idx+1]
        drag_start = block.find("onDragOver")
        print("Drag start:", drag_start)
        div_start = block.rfind("<div", 0, drag_start)
        print("Div start:", div_start)
        div_depth = 0
        div_end = -1
        div_iter = re.finditer(r"<\/?div\b", block[div_start:])
        for m in div_iter:
            if m.group(0) == "<div":
                div_depth += 1
            else:
                div_depth -= 1
                if div_depth == 0:
                    div_end = div_start + m.end() + 1
                    break
        print("Div end:", div_end)
        if div_end != -1:
            chat_col_inner = block[drag_start:div_end]
            floating_button_idx = block.find("{showScrollButton", div_end)
            print("Floating button idx:", floating_button_idx)
