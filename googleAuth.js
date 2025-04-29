const { google } = require('googleapis');
const { JSDOM } = require('jsdom'); // You can use jsdom to parse the HTML
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { get } = require('http');

const OAuth2 = google.auth.OAuth2;
require('dotenv').config(); // Load .env file for sensitive information

const loadCredentials = () => {
    try {
      const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf-8'));
      
      return {
        client_id: credentials.installed.client_id,
        client_secret: credentials.installed.client_secret,
        redirect_uris: credentials.installed.redirect_uris,
      };
    } catch (err) {
      console.error('Error loading credentials from google-credentials.json:', err);
      throw new Error('Failed to load credentials');
    }
  };
  
const credentials = loadCredentials();

// Create OAuth2 client
const oauth2Client = new OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0]
);

// Generate Google authorization URL to request access
function generateAuthUrl() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',  // Important for getting refresh token
    scope: ['https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send'
    ], // Adjust scope as needed
  });
  console.log('Authorization URL:', authUrl);
  return authUrl;
}

// Exchange authorization code for tokens (access & refresh tokens)
async function getTokens(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Access Token:', tokens.access_token);
    console.log('Refresh Token:', tokens.refresh_token);
    // Save these tokens securely (e.g., in .env or a database)
    oauth2Client.setCredentials(tokens);
    return tokens; // Return tokens for use in other parts of the app
  } catch (err) {
    console.error('Error getting tokens:', err);
    throw new Error('Failed to get tokens');
  }
}

// Refresh the access token using the stored refresh token
async function refreshAccessToken() {
  try {
    const credentials = { refresh_token: process.env.REFRESH_TOKEN };
    oauth2Client.setCredentials(credentials);
    const { token } = await oauth2Client.getAccessToken();
    return token; // Return the new access token
  } catch (err) {
    console.error('Error refreshing token:', err);
    throw new Error('Failed to refresh token');
  }
}

async function fetchMagicLinkEmail() {
    try {
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'from:info@wolt.com subject:כניסה לחשבון ב-Wolt', // Adjust query as needed
      });
  
      const messages = res.data.messages;
      if (messages && messages.length) {
        // Fetch the email body content
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: messages[0].id,
        });
  
        const magicLink = extractMagicLinkFromEmail(message.data.payload.parts);
        return magicLink;
      } else {
        console.log('No magic link email found!');
        return null;
      }
    } catch (err) {
      console.error('Error fetching email:', err);
      throw new Error('Failed to fetch magic link email');
    }
  }
  
  // Function to extract the magic link from the email's HTML body
  function extractMagicLinkFromEmail(parts) {
    // Loop through the parts of the email to find the HTML body
    for (let part of parts) {
      if (part.mimeType === 'text/html') {
        const htmlContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
        const magicLink = extractLinkFromHtml(htmlContent);
        return magicLink;
      }
    }
    return null;
  }
  
  // Function to extract the magic link from the HTML content
  function extractLinkFromHtml(htmlContent) {
    const dom = new JSDOM(htmlContent);
    const button = dom.window.document.querySelector('a'); // Assuming the link is inside an <a> tag
    if (button && button.href) {
      return button.href;
    } else {
      console.log('No button with magic link found!');
      return null;
    }
  }
  async function fetchWoltGiftCardCodes() {
    try {
      const token = await refreshAccessToken();
      process.env.REFRESH_TOKEN = token;
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const {lastDay, nextDay} = getLastAndNextDay();
      const query = `from:info@wolt.com subject:"הגיפט קארד של Wolt הגיע ומחכה לשליחה :)" after:${lastDay} before:${nextDay}`;
    // const query = `from:info@wolt.com subject:"הגיפט קארד של Wolt הגיע ומחכה לשליחה :)" after:2025-04-27T22:00:00.000Z before:2025-04-28T00:00:00.000Z`;

        console.log(query)
      // Search for the gift card email
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: query, // Match exactly the subject
      });
      console.log(res.data.messages)
      const messages = res.data.messages;
      if (!messages || !messages.length) {
        console.log('No Wolt gift card email found!');
        return null;
      }
  
      const messageId = messages[0].id;
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
      });
  
      const parts = message.data.payload.parts || [];
      const pdfAttachments = parts.filter(part => 
        part.filename && part.filename.endsWith('.pdf') && part.body && part.body.attachmentId
      );
  
      if (!pdfAttachments.length) {
        console.log('No PDF attachments found.');
        return null;
      }
  
      const codes = [];
  
      // Download and parse each PDF
      for (const attachment of pdfAttachments) {
        const attachmentData = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId,
          id: attachment.body.attachmentId,
        });
  
        const pdfBuffer = Buffer.from(attachmentData.data.data, 'base64');
        const pdfText = await pdfParse(pdfBuffer);
  
        const code = extractCodeFromPdfText(pdfText.text);
        if (code) {
          codes.push(code);
        }
      }
  
      return codes;
  
    } catch (err) {
      console.error('Error fetching Wolt gift card email:', err);
      throw new Error('Failed to fetch Wolt gift card email');
    }
  }
  function extractCodeFromPdfText(text) {
    // Example: If the code looks like "WOLT-XXXX-YYYY" (adapt the regex!)
    const match = text.match(/CODE:\s*(\w{8})/); 

    if (match) {
      console.log('Extracted gift card code:',match);
      return match[1];
    } else {
      console.log('No gift card code found in PDF.');
      return null;
    }
  }

  function getLastAndNextDay() {
    const today = new Date();
    const lastDay = new Date(today);
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);
    const formatedLastDay = lastDay.toISOString().split('T')[0];
    const formatedNextDay = nextDay.toISOString().split('T')[0];
    return { lastDay:formatedLastDay, nextDay:formatedNextDay };
  }
  async function sendErrorEmail(subject, body) {
    const token = await refreshAccessToken();
    process.env.REFRESH_TOKEN = token;
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
    const rawMessage = [
      `To: ${process.env.WOLT_EMAIL}`,
      'Subject: ' + subject,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\n');
  
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });
  }
  
module.exports = {
  generateAuthUrl,
  getTokens,
  refreshAccessToken,
  fetchMagicLinkEmail,
  fetchWoltGiftCardCodes,
  sendErrorEmail,
};
