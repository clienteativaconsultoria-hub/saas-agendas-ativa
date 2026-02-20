import requests

url = "https://files.greatpages.com.br/arquivos/paginas_editor/400225-2286f1d375ebbfb12cbc157e3d82010e.svg"
response = requests.get(url)

if response.status_code == 200:
    with open("public/favicon.svg", "w", encoding="utf-8") as f:
        f.write(response.text)
    print("Favicon downloaded successfully.")
else:
    print(f"Failed to download favicon. Status code: {response.status_code}")
