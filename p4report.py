import subprocess
import html
import os
import sys

OUTPUT_FILE = os.path.expanduser("~/p4_synced_changelists.html")

def run_p4_command(cmd):
    result = subprocess.run(["p4"] + cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("Error:", result.stderr.strip())
        return None
    return result.stdout.strip()

def get_changelist_details(cl_number):
    output = run_p4_command(["describe", "-s", str(cl_number)])
    if not output:
        return None

    lines = output.splitlines()
    description_lines = []
    files = []
    user, date = "unknown", "unknown"

    for line in lines:
        if line.startswith("Change"):
            # Example: Change 12345 on 2025/08/26 by user@workspace 'desc'
            parts = line.split()
            if len(parts) >= 6:
                date = parts[3]
                user = parts[5].split("@")[0]
        elif line.startswith("\t") and not line.startswith("\t..."):
            description_lines.append(line.strip())
        elif line.startswith("... "):
            fpath = line.replace("... ", "").split("#")[0]
            files.append(fpath)

    description = " ".join(description_lines).strip()
    return {
        "id": cl_number,
        "user": user,
        "date": date,
        "description": description if description else "(no description)",
        "files": files
    }

def append_changelist_to_html(details):
    # Make each file path a clickable link with p4v:// URI
    file_divs = "".join(
        f"<a class='file' href='p4v://{html.escape(f)}' target='_blank'>{html.escape(f)}</a>"
        for f in details["files"]
    )

    block = f"""
    <div class="changelist" data-cl="{details['id']}">
        <h2 onclick="toggleFiles(this)">Changelist {details['id']}</h2>
        <div class="meta">
            <strong>User:</strong> {html.escape(details['user'])} &nbsp;|&nbsp;
            <strong>Date:</strong> {html.escape(details['date'])}
        </div>
        <div class="description">{html.escape(details['description'])}</div>
        <div class="files">
            {file_divs}
        </div>
    </div>
    """

    if not os.path.exists(OUTPUT_FILE):
        # New HTML document
        html_content = f"""
        <html>
        <head>
            <title>Synced Perforce Changelists</title>
            <style>
                body {{ font-family: Arial, sans-serif; background: #f5f5f5; }}
                h1 {{ margin-left: 20px; }}
                .controls {{ margin: 20px; }}
                .controls input {{ padding: 6px; width: 250px; }}
                .changelist {{ background: #fff; margin: 20px; padding: 15px; border-radius: 6px;
                               box-shadow: 0 2px 6px rgba(0,0,0,0.1); }}
                .changelist h2 {{ margin-top: 0; font-size: 18px; cursor: pointer; }}
                .meta {{ font-size: 12px; color: #555; margin-bottom: 6px; }}
                .description {{ margin: 8px 0; font-style: italic; }}
                .files {{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }}
                .file {{ background: #eee; padding: 6px 10px; border-radius: 4px;
                         font-size: 13px; white-space: nowrap; text-decoration: none; color: black; }}
                .file:hover {{ background: #ccc; }}
                .hidden {{ display: none; }}
            </style>
            <script>
                function toggleFiles(header) {{
                    const filesDiv = header.parentElement.querySelector(".files");
                    filesDiv.classList.toggle('hidden');
                }}
                function filterFiles() {{
                    let input = document.getElementById("searchBox").value.toLowerCase();
                    let changelists = document.getElementsByClassName("changelist");
                    for (let cl of changelists) {{
                        let desc = cl.querySelector(".description").textContent.toLowerCase();
                        let files = cl.getElementsByClassName("file");
                        let match = desc.includes(input);
                        for (let f of files) {{
                            if (f.textContent.toLowerCase().includes(input)) match = true;
                        }}
                        cl.style.display = match ? "" : "none";
                    }}
                }}
                function sortChangelists() {{
                    let container = document.getElementById("clContainer");
                    let blocks = Array.from(container.getElementsByClassName("changelist"));
                    blocks.sort((a,b) => parseInt(b.dataset.cl) - parseInt(a.dataset.cl));
                    for (let b of blocks) container.appendChild(b);
                }}
            </script>
        </head>
        <body onload="sortChangelists()">
            <h1>Synced Changelists</h1>
            <div class="controls">
                <input type="text" id="searchBox" placeholder="Search by file or description..."
                       onkeyup="filterFiles()"/>
            </div>
            <div id="clContainer">
                {block}
            </div>
        </body>
        </html>
        """
    else:
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            old_content = f.read()
        html_content = old_content.replace("</div>\n</body>", f"{block}</div>\n</body>")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"✅ Added changelist {details['id']} to {OUTPUT_FILE}")

def main():
    if len(sys.argv) < 2:
        print("Usage: script.py <changelist_number>")
        return

    cl_number = sys.argv[1]
    details = get_changelist_details(cl_number)
    if details:
        append_changelist_to_html(details)

if __name__ == "__main__":
    main()