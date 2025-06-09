console.log("🧪 ENV Check - #PQJJQ2PG:", process.env.CLAN_TAG);
require('dotenv').config();
const cron = require('node-cron');
const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// ✅ Decode credentials.json from GOOGLE_CREDS_B64
const credsPath = path.join(__dirname, 'credentials.json');
if (!fs.existsSync(credsPath)) {
    const b64 = process.env.GOOGLE_CREDS_B64;
    if (b64) {
        fs.writeFileSync(credsPath, Buffer.from(b64, 'base64').toString());
        console.log("✅ credentials.json created from env");
    } else {
        console.error("❌ Missing GOOGLE_CREDS_B64 variable!");
    }
}

// ✅ API URL builder
function getWarApiUrl(mode) {
    const clanTag = encodeURIComponent(process.env.CLAN_TAG || '#PQJJQ2PG');
    switch (mode.toLowerCase()) {
        case 'cwl':
            return `https://api.clashofclans.com/v1/clans/${clanTag}/currentwar/leaguegroup`;
        case 'friendly':
        case 'normal':
        default:
            return `https://api.clashofclans.com/v1/clans/${clanTag}/currentwar`;
    }
}

// ✅ Fetch war data
async function getWarData(mode = 'normal') {
    const apiUrl = getWarApiUrl(mode);
    console.log(`📡 Fetching ${mode.toUpperCase()} WAR from: ${apiUrl}`);

    const response = await axios.get(apiUrl, {
        headers: {
            Authorization: `Bearer ${process.env.COC_API_TOKEN}`,
        }
    });

    return response.data;
}

// ✅ Auth for Google Sheets
async function getSheet() {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
}

// ✅ Format war data (per player)
function formatWarData(warData, side = 'clan') {
    const data = [
        ['Tag', 'Name', 'Townhall', 'Map Pos', 'Total Stars', 'Total Destruction', '1st Attack', '1st Stars', '1st Destruction', '2nd Attack', '2nd Stars', '2nd Destruction']
    ];

    warData[side]?.members?.forEach((member) => {
        const base = [member.tag, member.name, member.townhallLevel, member.mapPosition];
        const attacks = warData.attacks?.filter(a => a.attackerTag === member.tag) || [];

        let totalStars = 0;
        let totalDestruction = 0;
        const attackData = [];

        attacks.forEach((a) => {
            attackData.push(a.defenderTag, a.stars, a.destructionPercentage);
            totalStars += a.stars;
            totalDestruction += a.destructionPercentage;
        });

        while (attackData.length < 6) attackData.push('', '', '');
        data.push([...base, totalStars, totalDestruction.toFixed(1), ...attackData]);
    });

    return data;
}

// ✅ Update both clan reports
async function updateSheetWithWar(warData, mode) {
    const sheets = await getSheet();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const ourData = formatWarData(warData, 'clan');
    const oppData = formatWarData(warData, 'opponent');

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Our Clan War Report!A1',
        valueInputOption: 'RAW',
        requestBody: { values: ourData }
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Opponent Clan War Report!A1',
        valueInputOption: 'RAW',
        requestBody: { values: oppData }
    });

    console.log("✅ Google Sheet updated (our & opponent data)");
}

// ✅ Manual endpoint
app.get('/update', async (req, res) => {
    const mode = req.query.mode || 'normal';
    try {
        const warData = await getWarData(mode);
        await updateSheetWithWar(warData, mode);
        res.send(`✅ ${mode.toUpperCase()} War Report Updated in Google Sheet!`);
    } catch (err) {
        console.error("❌ Error:", err.response?.data || err.message);
        res.status(500).send(`❌ Failed to update ${mode.toUpperCase()} war data.`);
    }
});

// ✅ Auto-update every 1 min
cron.schedule('*/1 * * * *', async () => {
    try {
        console.log("⏳ [CRON] Auto-updating LIVE war data...");
        const warData = await getWarData('normal');
        await updateSheetWithWar(warData, 'normal');
        console.log("✅ [CRON] Google Sheet updated successfully.");
    } catch (err) {
        console.error("❌ [CRON] Failed to update:", err.response?.data || err.message);
    }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running: http://localhost:${PORT}`));
