console.log("🧪 ENV Check - #PQJJQ2PG:", process.env.CLAN_TAG);
const cron = require('node-cron');
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// ✅ Get correct API URL based on war mode
function getWarApiUrl(mode) {
    const clanTag = encodeURIComponent('#PQJJQ2PG'); // Hardcoded just to verify
    switch (mode.toLowerCase()) {
        case 'cwl':
            return `https://api.clashofclans.com/v1/clans/${clanTag}/currentwar/leaguegroup`;
        case 'friendly':
        case 'normal':
        default:
            return `https://api.clashofclans.com/v1/clans/${clanTag}/currentwar`;
    }
}

// ✅ Fetch war data from Clash of Clans API
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

// ✅ Update Google Sheet with war data
async function updateSheetWithWar(warData, mode) {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const values = [
        [`📋 War Mode`, mode.toUpperCase()],
        ['🏰 Our Clan', warData.clan?.name || 'N/A'],
        ['⚔️ Enemy Clan', warData.opponent?.name || 'N/A'],
        ['📶 War State', warData.state || 'N/A'],
        [],
        ['👨 Attacker', '🛡️ Defender', '⭐ Stars', '💥 Destruction %']
    ];

    if (warData.clan?.attacks) {
        warData.clan.attacks.forEach(attack => {
            values.push([
                attack.attackerTag,
                attack.defenderTag,
                attack.stars,
                `${attack.destructionPercentage}%`
            ]);
        });
    } else {
        values.push(['No attacks yet']);
    }

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'RAW',
        requestBody: { values }
    });
}

// ✅ Endpoint to trigger sheet update manually
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
// ⏱️ Auto-update every 1 minute
cron.schedule('*/1 * * * *', async () => {
    try {
        console.log("⏳ [CRON] Auto-updating LIVE war data...");
        const warData = await getWarData('normal');
        await updateSheetWithWar(warData, 'normal');
        console.log("✅ [CRON] Google Sheet updated successfully.");
    } catch (err) {
        console.error("❌ [CRON] Failed to update live war data:", err.response?.data || err.message);
    }
});

// ✅ Start Express server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running: http://localhost:${PORT}`));


