import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const key = JSON.parse(keyJson);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    if (req.method === 'GET') {
      // Read all candidates from row 4 onward (rows 1-3 are headers), columns A:AY (51 cols)
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Candidatos!A4:AY',
      });
      const rows = response.data.values || [];
      res.status(200).json({ rows });

    } else if (req.method === 'POST') {
      const { action, rowIndex, rowData, newRow } = req.body;

      if (action === 'update' && rowIndex !== undefined && rowData) {
        // rowIndex is 0-based among data rows; sheet row = rowIndex + 4
        const sheetRow = rowIndex + 4;
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `Candidatos!A${sheetRow}:AY${sheetRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [rowData] },
        });
        res.status(200).json({ success: true });

      } else if (action === 'append' && newRow) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'Candidatos!A4:AY',
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [newRow] },
        });
        res.status(200).json({ success: true });

      } else {
        res.status(400).json({ error: 'Invalid action or missing parameters' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Sheets API error:', err);
    res.status(500).json({ error: err.message });
  }
}
