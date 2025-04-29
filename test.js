const { generateAuthUrl, getTokens, refreshAccessToken, fetchMagicLinkEmail, fetchWoltGiftCardCodes} = require('./googleAuth'); // Import the functions from googleAuth.js
require('dotenv').config(); // Ensure that .env is loaded

describe('Google Auth Functions', () => {
//   // Test for the generateAuthUrl function
    test('generateAuthUrl() should return an authorization URL', () => {
        const authUrl = generateAuthUrl();
        expect(authUrl).toBeDefined(); // Check that the URL is defined
        expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth'); // Make sure it includes Google's auth URL
        console.log('Authorization URL:', authUrl);
    });

//   Test for the getTokens function
  test('getTokens() should return access and refresh tokens when given a valid authorization code', async () => {
    // Mock authorization code (for testing, use a real authorization code in actual use)
    const code = '4/0Ab_5qlkMkEC_dsPQ-leYhawxtdRWtGblvpinR0Y6wjPESG84-YpJ1946G4qpc2UXiufVcA';

    // Mock the OAuth2 client
    const tokens = await getTokens(code);
    expect(tokens).toHaveProperty('access_token');
    expect(tokens).toHaveProperty('refresh_token');
    expect(tokens.access_token).toBeDefined();
    expect(tokens.refresh_token).toBeDefined();
  });

  // Test for the refreshAccessToken function
  test('refreshAccessToken() should return a new access token', async () => {
//     // Mock the refresh token (use a real refresh token in actual use)
//     // process.env.REFRESH_TOKEN = 'valid_refresh_token_here'; // Set the refresh token for testing
    
    const token = await refreshAccessToken();
    process.env.REFRESH_TOKEN = token;
    expect(token).toBeDefined(); // Ensure the token is returned
    expect(typeof token).toBe('string'); // Ensure the token is a string
  });

//   test('fetchMagicLinkEmail() should return the email associated with the magic link', async () => {
//     // Mock the magic link (use a real magic link in actual use)
//     // const magicLink = 'https://wolt.com/me/magic_login?email=valid_email_here&email_hash=valid_email_hash_here&token=valid_token_here';

//     const email = await fetchMagicLinkEmail();
//     console.log('Magic Link Email:', email);
//     expect(email).toBeDefined(); // Ensure the email is returned
//     expect(typeof email).toBe('string'); // Ensure the email is a string
//   });

//   test('sendMagicLink() should send a magic link email', async () => {
//     await sendMagicLink();
//     console.log('Magic link email sent successfully');
//   });

  test('fetchWoltGiftCardCodes() should return gift card codes', async () => {
    const giftCardCodes = await fetchWoltGiftCardCodes();
    console.log('Gift Card Codes:', giftCardCodes);
    expect(giftCardCodes).toBeDefined(); // Ensure gift card codes are returned
    expect(Array.isArray(giftCardCodes)).toBe(true); // Ensure gift card codes are an array
  });

});
