import urllib.request

html = urllib.request.urlopen("https://claudecookie.com/", timeout=20).read().decode("utf-8", "replace")
idx = html.find("https://github.com/Chumbayoumba/claudecookie")
print("live_github", idx >= 0)
if idx >= 0:
    print(html[idx - 120 : idx + 160])
