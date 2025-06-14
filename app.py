import requests
import gspread
import time
import pytz
import os
from dotenv import load_dotenv
load_dotenv()
import base64
import json
from datetime import datetime, timedelta
from oauth2client.service_account import ServiceAccountCredentials
from gspread.exceptions import APIError
from dotenv import load_dotenv

# --------------------------------
# 🔐 Load Environment Variables
# --------------------------------
load_dotenv()

COC_API_TOKEN = os.getenv("COC_API_TOKEN")
GOOGLE_CREDS_B64 = os.getenv("GOOGLE_CREDS_B64")

if not COC_API_TOKEN:
    print("❌ COC_API_TOKEN not found in .env file!")
    exit()
else:
    print("✅ Token loaded successfully")

if not GOOGLE_CREDS_B64:
    print("❌ GOOGLE_CREDS_B64 not found in .env file!")
    exit()

# --------------------------------
# 🔧 Configuration
# --------------------------------
CLAN_TAG = '#PQJJQ2PG'.replace('#', '%23')
SHEET_NAME = 'war report'
WORKSHEET_NAME = 'Sheet1'
RETRY_LIMIT = 5
RETRY_DELAY = 60  # seconds
UPDATE_INTERVAL = 2 * 60  # 2 minutes
IST = pytz.timezone('Asia/Kolkata')

# --------------------------------
# 📝 Setup Google Sheets
# --------------------------------
scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
service_account_info = json.loads(base64.b64decode(GOOGLE_CREDS_B64))
creds = ServiceAccountCredentials.from_json_keyfile_dict(service_account_info, scope)
client = gspread.authorize(creds)

retry_count = 0
while retry_count < RETRY_LIMIT:
    try:
        sheet = client.open(SHEET_NAME).worksheet(WORKSHEET_NAME)
        break
    except APIError as e:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"❌ [{now}] Sheet access error: {e}")
        retry_count += 1
        time.sleep(RETRY_DELAY)

if retry_count == RETRY_LIMIT:
    print("❌ Too many retries. Exiting.")
    exit()

# --------------------------------
# ⏰ Time Formatter (UTC → IST)
# --------------------------------
def format_time(ts_str):
    dt = datetime.strptime(ts_str, "%Y%m%dT%H%M%S.%fZ")
    ist_dt = dt + timedelta(hours=5, minutes=30)
    return ist_dt.strftime("%Y-%m-%d %H:%M")

# --------------------------------
# 📡 Fetch War Data from CoC API
# --------------------------------
def fetch_clan_war():
    headers = {
        "Authorization": f"Bearer {COC_API_TOKEN}",
        "Accept": "application/json"
    }
    url = f"https://api.clashofclans.com/v1/clans/{CLAN_TAG}/currentwar"
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"API Error: {response.status_code} - {response.text}")
    return response.json()

# --------------------------------
# 📊 Update War Timing at A1
# --------------------------------
def update_timing_info(sheet, war_data):
    start_time = war_data.get('startTime')
    end_time = war_data.get('endTime')
    state = war_data.get('state', 'N/A')

    war_start = format_time(start_time) if start_time else 'N/A'
    war_end = format_time(end_time) if end_time else 'N/A'
    now = datetime.utcnow() + timedelta(hours=5, minutes=30)
    time_left = datetime.strptime(war_end, "%Y-%m-%d %H:%M") - now if war_end != 'N/A' else 'N/A'

    timing_info = [
        ['🕒 War State', state],
        ['📅 War Start Time', war_start],
        ['⚔️ War End Time', war_end],
        ['⏱️ Time Left', str(time_left).split('.')[0] if time_left != 'N/A' else 'N/A']
    ]
    sheet.update(range_name='A1', values=timing_info)

# --------------------------------
# 📝 Update Clan + Opponent Reports
# --------------------------------
def update_sheet(war_data):
    # --- Our Clan Report (A7)
    our_members = war_data['clan']['members']
    our_data = [[
        'No', 'Tag', 'Name', 'Townhall', 'Map Pos', 'Total Stars', 'Destruction %',
        '1st Attack', 'Stars', 'Destruction', '2nd Attack', 'Stars', 'Destruction', 'Points'
    ]]

    for i, member in enumerate(our_members, 1):
        attacks = member.get('attacks', [])
        attack1 = attacks[0] if len(attacks) > 0 else {}
        attack2 = attacks[1] if len(attacks) > 1 else {}

        row = [
            i,
            member.get('tag', ''),
            member.get('name', ''),
            member.get('townhallLevel', ''),
            member.get('mapPosition', ''),
            member.get('stars', ''),
            f"{member.get('destructionPercentage', 0)}%",
            attack1.get('attackerTag', ''),
            attack1.get('stars', ''),
            f"{attack1.get('destructionPercentage', 0)}%",
            attack2.get('attackerTag', ''),
            attack2.get('stars', ''),
            f"{attack2.get('destructionPercentage', 0)}%",
            len(attacks)
        ]
        our_data.append(row)
    sheet.update(range_name='A7', values=our_data)

    # --- Opponent Clan Report (A60)
    enemy_members = war_data['opponent']['members']
    enemy_data = [[
        'No', 'Tag', 'Name', 'Townhall', 'Map Pos', 'Total Stars', 'Destruction %',
        '1st Attack', 'Stars', 'Destruction', '2nd Attack', 'Stars', 'Destruction', 'Points'
    ]]

    for i, member in enumerate(enemy_members, 1):
        attacks = member.get('attacks', [])
        attack1 = attacks[0] if len(attacks) > 0 else {}
        attack2 = attacks[1] if len(attacks) > 1 else {}

        row = [
            i,
            member.get('tag', ''),
            member.get('name', ''),
            member.get('townhallLevel', ''),
            member.get('mapPosition', ''),
            member.get('stars', ''),
            f"{member.get('destructionPercentage', 0)}%",
            attack1.get('attackerTag', ''),
            attack1.get('stars', ''),
            f"{attack1.get('destructionPercentage', 0)}%",
            attack2.get('attackerTag', ''),
            attack2.get('stars', ''),
            f"{attack2.get('destructionPercentage', 0)}%",
            len(attacks)
        ]
        enemy_data.append(row)
    sheet.update(range_name='A60', values=enemy_data)

    # --- Summary at A120
    summary = [
        ['Summary'],
        ['War State:', war_data.get('state')],
        ['Team Size:', war_data.get('teamSize')],
        ['Our Stars:', war_data['clan'].get('stars')],
        ['Enemy Stars:', war_data['opponent'].get('stars')],
        ['Our Destruction:', f"{war_data['clan'].get('destructionPercentage', 0)}%"],
        ['Enemy Destruction:', f"{war_data['opponent'].get('destructionPercentage', 0)}%"]
    ]
    sheet.update(range_name='A120', values=summary)

# --------------------------------
# 🔁 Infinite War Update Loop
# --------------------------------
while True:
    try:
        now = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S")
        sheet.update(range_name='B5', values=[[f"🕒 War data updated at {now}"]])
        war_data = fetch_clan_war()
        update_timing_info(sheet, war_data)
        update_sheet(war_data)

        with open("log.txt", "a", encoding="utf-8") as log:
            log.write(f"[{now}] ✅ War updated\n")

        print(f"✅ War data updated at {now}")

    except Exception as e:
        print(f"❌ Error: {e}")
        with open("log.txt", "a", encoding="utf-8") as log:
            log.write(f"[{now}] ❌ Error: {e}\n")

    print("⏳ Waiting 2 minutes before next update...\n")
    time.sleep(UPDATE_INTERVAL)
