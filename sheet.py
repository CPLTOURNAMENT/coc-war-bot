import gspread
from oauth2client.service_account import ServiceAccountCredentials

scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]

creds = ServiceAccountCredentials.from_json_keyfile_name("service_account.json", scope)

client = gspread.authorize(creds)

# Example - 1st worksheet open pannalam
sheet = client.open_by_key("1r2qMX1473Jyvck9xepTzyPoKiIqKrdnAB9ulx8dzMRI").sheet1

print(sheet.get_all_records())

def get_sheet():
    return sheet  # or return whatever variable you are using to interact with the Google Sheet
