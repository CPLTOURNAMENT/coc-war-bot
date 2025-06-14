import base64

with open("google-credentials.json", "rb") as f:
    data = f.read()
    b64 = base64.b64encode(data).decode()
    print(b64)
