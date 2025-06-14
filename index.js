require('dotenv').config(); // 💥 Must be FIRST
console.log("🧪 ENV Check - CLAN_TAG:", process.env.CLAN_TAG);
const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');
const cron = require('node-cron');

const app = express();
app.use(express.json());

// ✅ Clash of Clans API URL builder
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

// ✅ Fetch Clash of Clans war data
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

// ✅ Authenticate with Google Sheets using GOOGLE_CREDS_B64
async function getSheetClient() {
    const creds = JSON.parse(Buffer.from(process.env.GOOGLE_CREDS_B64, 'base64').toString());
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'], // ✅ FIXED SCOPE
    });

    return google.sheets({ version: 'v4', auth });
}

// ✅ Format war player data for sheet
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

// ✅ Push both clan reports to Google Sheet
async function updateSheetWithWar(warData, mode) {
    const sheets = await getSheetClient();
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

    console.log("✅ Google Sheet updated (our + opponent)");
}

// ✅ Manual trigger via URL
app.get('/update', async (req, res) => {
    const mode = req.query.mode || 'normal';
    try {
        const warData = await getWarData(mode);
        await updateSheetWithWar(warData, mode);
        res.send(`✅ ${mode.toUpperCase()} War Report Updated in Google Sheet!`);
    } catch (err) {
        console.error("❌ Error updating:", err.response?.data || err.message);
        res.status(500).send(`❌ Failed to update ${mode.toUpperCase()} war data.`);
    }
});

// ✅ CRON job: every 1 minute auto update
cron.schedule('*/1 * * * *', async () => {
    try {
  const raw = process.env.GOOGLE_CREDS_B64;
  console.log("🔍 Base64 Length:", raw.length);
  JSON.parse(Buffer.from(raw, 'base64').toString()); // validate JSON decode
  console.log("✅ Valid JSON credentials!");
} catch (err) {
  console.error("❌ Invalid JSON from GOOGLE_CREDS_B64:", err.message);
}

});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
