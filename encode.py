import os, base64, json

# .env file-la irundhu base64 edukkura
creds_b64 = os.getenv("GOOGLE_CREDS_B64")

# base64 decode pannrom
decoded = base64.b64decode(creds_b64).decode("utf-8")

# FIX: \\n => \n
decoded = decoded.replace("\\n", "\n")

# JSON-a save pannrom
with open("service_account.json", "w", encoding="utf-8") as f:
    f.write(decoded)
