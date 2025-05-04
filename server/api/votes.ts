// server/api/votes.ts
// Fetches the initial snapshot of votes directly from Google Sheets
import { google } from 'googleapis';
import { defineEventHandler, createError, H3Event } from 'h3';

interface VoteInfo { name: string; votes: number; list: string; }
interface ApiResponse { votes: VoteInfo[]; }

export default defineEventHandler(async (event: H3Event): Promise<ApiResponse> => {
  const config = useRuntimeConfig(event);
  const clientEmail = config.googleSheetsClientEmail;
  const privateKey = config.googleSheetsPrivateKey?.replace(/\\n/g, '\n');
  const sheetId = config.googleSheetId;

  if (!clientEmail || !privateKey || !sheetId) {
    console.error('[API /votes Error] Missing Google Sheets config.');
    throw createError({ statusCode: 500, statusMessage: 'Server configuration error.' });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const sheetName = 'Form Responses 1'; // <-- Your Sheet Name
  const headerRange = `'${sheetName}'!C1:AF1`; // <-- Headers Range
  const countRange = `'${sheetName}'!C2:AF2`;   // <-- Counts Range

  try {
    const [headerResponse, countResponse] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: headerRange }),
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: countRange })
    ]);
    const headers = headerResponse.data.values?.[0];
    const counts = countResponse.data.values?.[0];

    if (!headers || !counts || headers.length === 0 || counts.length === 0) {
      console.warn('[API /votes Warn] Headers/counts missing/empty.');
      return { votes: [] };
    }

    const processedVotes: VoteInfo[] = [];
    headers.forEach((header, index) => {
      if (index >= counts.length) return;
      const rawCount = counts[index];
      const voteCount = parseInt(String(rawCount || '0').trim(), 10);
      const headerStr = String(header || '').trim();
      const nameMatch = headerStr.match(/\[(.*?)\]/);
      const candidateName = nameMatch ? nameMatch[1].trim() : headerStr;
      let listName = 'Unknown List';
      if (headerStr.includes('لائحة ٢٠٤٠')) listName = 'لائحة ٢٠٤٠';
      else if (headerStr.includes('قرطبا بتستاهل')) listName = 'قرطبا بتستاهل';

      if (candidateName) {
         processedVotes.push({
           name: candidateName,
           votes: isNaN(voteCount) ? 0 : voteCount,
           list: listName,
         });
      }
    });
    console.log(`[API /votes Info] Successfully processed ${processedVotes.length} candidates for initial load.`);
    return { votes: processedVotes };

  } catch (error: any) {
    const googleError = error.response?.data?.error;
    if (googleError) {
         console.error('[API /votes Error] Google API Error:', JSON.stringify(googleError));
         throw createError({ statusCode: googleError.code || 500, statusMessage: `Google API Error: ${googleError.message}` });
    } else {
        console.error('[API /votes Error] Failed processing:', error.message);
        throw createError({ statusCode: 500, statusMessage: 'Internal server error fetching initial votes.' });
    }
  }
});