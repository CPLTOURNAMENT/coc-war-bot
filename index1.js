require('dotenv').config();
console.log("💥 Loaded ENV:", process.env); // Add this line to debug
const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

// ✅ GET WAR LOG FROM API
async function getWarLog() {
    const clanTag = encodeURIComponent('#PQJJQ2PG'); // hardcoded to test
    const apiUrl = `https://api.clashofclans.com/v1/clans/${clanTag}/warlog`;

    console.log("💡 Clan Tag from .env:", process.env.CLAN_TAG);

    console.log("🔍 Hitting API URL:", apiUrl);

    const response = await axios.get(apiUrl, {
        headers: {
            Authorization: `Bearer ${process.env.COC_API_TOKEN}`,
        },
        params: {
            limit: 7
        }
    });

    return response.data.items;
}

// ✅ UPDATE GOOGLE SHEET
async function updateGoogleSheet(warLog) {
    const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    const values = [
        ['Day', 'Opponent', 'Result', 'Our Stars', 'Our Destruction', 'Opponent Stars', 'Opponent Destruction']
    ];

    warLog.forEach((war, i) => {
        values.push([
            `Day ${i + 1}`,
            war.opponent.name,
            war.result,
            war.clan.stars,
            `${war.clan.destructionPercentage}%`,
            war.opponent.stars,
            `${war.opponent.destructionPercentage}%`,
        ]);
    });

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'RAW',
        requestBody: {
            values
        }
    });
}

// ✅ EXPRESS ROUTE
app.get('/update', async (req, res) => {
    try {
        const warLog = await getWarLog();
        await updateGoogleSheet(warLog);
        res.send('✅ CWL-style War Report Updated in Google Sheet!');
    } catch (err) {
        console.error("❌ Error:", err.response?.data || err.message);
        res.status(500).send('❌ Error fetching or updating data.');
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
