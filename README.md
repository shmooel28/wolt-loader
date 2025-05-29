# Wolt Gift Card Automation

This Node.js script automates the process of purchasing and redeeming Wolt gift cards using Puppeteer with stealth mode and Cibus as a payment method. It also fetches gift card codes from Gmail and redeems them on the user's Wolt account.

## 🧰 Features

- Automated browser actions using Puppeteer Extra (Stealth mode enabled).
- Adds a specific gift card to the Wolt cart.
- Handles the full checkout process using Cibus iframe login.
- Fetches gift card codes via Gmail API.
- Redeems gift cards on Wolt after purchase.
- Sends an error email notification if anything fails.

---

## 📦 Prerequisites

- Node.js (v18)
- Chrome or Chromium (installed automatically by Puppeteer)
- A Gmail account with access to gift card emails
- Environment variables (see `.env` section below)
- Valid Wolt login cookies (`wolt-cookies.json` file)
- Vaild google-credentials.json file

---

## 🛠 Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/shmooel28/wolt-loader.git
   cd wolt-loader

2. Install dependencies:

   ```bash
    npm install
   
## 🔐 Environment Variables (`.env`)

Create a `.env` file in the root directory with the following content:

```env
WOLT_EMAIL=wolt_email@example.com
# Cibus login credentials
SIBUS_EMAIL=your_cibus_email@example.com
SIBUS_PASSWORD=your_cibus_password

# Gmail API credentials
GMAIL_CLIENT_ID=your_google_client_id
GMAIL_CLIENT_SECRET=your_google_client_secret
GMAIL_REDIRECT_URI=your_google_redirect_uri
GMAIL_REFRESH_TOKEN=your_google_refresh_token
```

## 📌 Note: To get Gmail API credentials, create a project on Google Cloud Console, enable Gmail API, and create OAuth 2.0 credentials.

## 🧠 How It Works
  Launches a browser and loads Wolt cookies.
  Adds a ₪35 gift card to the cart and proceeds to checkout.
  Logs into Cibus in an iframe and completes payment.
  Fetches gift card codes from Gmail.
  Redeems codes on your Wolt account.

## 🧰 Usage
  ```bash
  node main.js
  ```
The script will open a browser, go through the full flow, and then redeem any available gift cards.

📬 Email on Error
If anything fails (e.g., button not found, balance too low), an email will be sent to the configured address via sendErrorEmail.

📄 License
This project is for educational use. You are responsible for complying with Wolt/Cibus terms of service.


