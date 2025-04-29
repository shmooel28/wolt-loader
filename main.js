const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const {fetchWoltGiftCardCodes, sendErrorEmail} = require('./googleAuth');
require('dotenv').config(); // Load environment variables

const woltGiftCardUrl = "https://wolt.com/en/isr/tel-aviv/venue/woltilgiftcards";
const woltRedeemCodeUrl = "https://wolt.com/en/me/redeem-code";
const cookiesFilePath = 'wolt-cookies.json';
const amountToBuy = 35;
// Sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Load saved cookies
const loadCookies = async (page) => {
  const cookies = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf8'));
  await page.setCookie(...cookies);
};

// Handle "Restore Order" popup if exists
const handleRestoreOrderPopup = async (page) => {
  const rejectButton = await page.waitForSelector('[data-test-id="restore-order-modal.reject"]', { timeout: 5000 }).catch(() => null);
  if (rejectButton) {
    await rejectButton.click();
    console.log('Restore order popup handled.');
  }
};

// Add gift card to cart
const addGiftCardToCart = async (page) => {
    const buttons = await page.$$('[data-test-id="horizontal-item-card-button"]');
    let addToCartButton;
    for (const button of buttons) {
        const labelledById = await button.evaluate(el => el.getAttribute('aria-labelledby'));
      
        if (labelledById) {
          // Escape manually if needed: replace ":" with "\\:" if you want
          const safeId = labelledById.replace(/:/g, '\\:'); 
      
          const labelElement = await page.$(`#${safeId}`);
          if (labelElement) {
            const labelText = await labelElement.evaluate(el => el.textContent.trim());      
            if (labelText.includes(`₪${amountToBuy}.00`)) {
              addToCartButton = button;
              break;
            }
          }
        }
      }
//    addToCartButton = await page.waitForSelector('[data-test-id="horizontal-item-card-button"]', { timeout: 5000, visible: true }).catch(() => null);
  if (addToCartButton) {
    await page.evaluate(button => button.click(), addToCartButton);
    console.log('Gift card added to cart.');

    const submitButton = await page.waitForSelector('[data-test-id="product-modal.submit"]', { timeout: 5000, visible: true }).catch(() => null);
    if (submitButton) {
      await page.evaluate(button => button.click(), submitButton);
      console.log('Submitted product modal.');
    }
  } else {
    throw new Error('Add to Cart button not found.');
  }
};

// Go to cart and proceed to checkout
const proceedToCheckout = async (page) => {
  const cartButton = await page.waitForSelector('[data-test-id="cart-view-button"]', { timeout: 5000, visible: true }).catch(() => null);
  if (cartButton) {
    await page.evaluate(button => button.click(), cartButton);
    console.log('Navigated to cart.');

    const nextButton = await page.waitForSelector('[data-test-id="CartViewNextStepButton"]', { timeout: 5000, visible: true }).catch(() => null);
    if (nextButton) {
      await page.evaluate(button => button.click(), nextButton);
      console.log('Proceeded to next step.');
      await sleep(3000);
    } else {
      throw new Error('Next step button not found.');
    }
  } else {
    throw new Error('Cart button not found.');
  }
};

// Send the order
const sendOrder = async (page) => {
  const sendOrderButton = await page.waitForSelector('[data-test-id="SendOrderButton"]', { timeout: 5000, visible: true }).catch(() => null);
  if (sendOrderButton) {
    await page.evaluate(button => button.click(), sendOrderButton);
    console.log('Send order clicked.');
    await handleCibusPayment(page);
  } else {
    throw new Error('Send Order button not found.');
  }
};
async function getBalance(cibusWindow) {
    const balanceElement = await cibusWindow.$('#divUserInfo big');
    if (!balanceElement) {
      throw new Error('Balance element not found.');
    }
    const balanceText = await balanceElement.evaluate(el => el.textContent.trim());
    const balance = parseFloat(balanceText.replace(/[^\d.-]/g, ''));
    return balance;
  }
// Handle Cibus iframe payment
const handleCibusPayment = async (page) => {
  const cibusIframe = await page.waitForSelector("iframe[name='cibus-challenge']").catch(() => null);
  if (!cibusIframe) {
    throw new Error('Cibus iframe not found.');
  }

  const cibusWindow = await cibusIframe.contentFrame();
  if (!cibusWindow) {
    throw new Error('Cibus iframe window not accessible.');
  }

  console.log('Cibus iframe loaded.');
  const usernameInput = await cibusWindow.waitForSelector('#txtUserName').catch(() => null);
  const passwordInput = await cibusWindow.waitForSelector('#txtPassword').catch(() => null);
  const submitButton = await cibusWindow.waitForSelector('#btnSubmit').catch(() => null);

  if (usernameInput && passwordInput && submitButton) {
    await cibusWindow.type('#txtUserName', process.env.SIBUS_EMAIL);
    await cibusWindow.type('#txtPassword', process.env.SIBUS_PASSWORD);
    console.log('Credentials filled.');
    await sleep(1000);
    await cibusWindow.evaluate(button => button.click(), submitButton);
    console.log('Cibus login submitted.');
    await sleep(2000);
    await cibusWindow.waitForSelector('#btnPay', { timeout: 5000 }).catch(() => null);
    const balance = await getBalance(cibusWindow);
    if (balance > 0) {
        console.log('Proceeding with payment, balance:', balance);
    } else {
        console.log('Insufficient balance:', balance);
        throw new Error('Not enough money to complete the payment.');
    }
    const payButton = await cibusWindow.waitForSelector('#btnPay').catch(() => null);
    if (payButton) {
      await cibusWindow.evaluate(button => button.click(), payButton);
      console.log('Payment completed.');
    } else {
      throw new Error('Cibus Pay button not found.');
    }
  } else {
    throw new Error('Cibus login inputs not found.');
  }
};

const getCodeFromMail = async (maxRetries = 5, retryInterval = 10000) => {
    let retries = 0;
    while (retries < maxRetries) {
      const giftCardCodes = await fetchWoltGiftCardCodes();
      if (giftCardCodes && giftCardCodes.length > 0) {
        return giftCardCodes;
      }
      await sleep(retryInterval);
      retries++;
    }
}

const redeemGiftCard = async (page, giftCardCodes) => {
    const redeemCodeInputSelector = '[data-test-id="redeem-code-input"]';
    await page.waitForSelector(redeemCodeInputSelector);
    const redeemButtonSelector = 'button[data-localization-key="user.redeem"]';
    const redeemButton = await page.$(redeemButtonSelector);
    if (!redeemButton) {
    throw new Error('Redeem button not found.');
    }
    const redeemCodeInput = await page.$(redeemCodeInputSelector);
    // Check if the input field exists
    if (!redeemCodeInput) {
        throw new Error('Code input not found.');
    }
    for (const code of giftCardCodes) {
      await redeemCodeInput.type(code);
      await sleep(500);
      await redeemButton.click();
      await sleep(1000);

    }
}
// Main function
(async () => {
  puppeteer.use(StealthPlugin());
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await loadCookies(page);
    await page.goto(woltGiftCardUrl);

    await handleRestoreOrderPopup(page);
    await addGiftCardToCart(page);
    await proceedToCheckout(page);
    await sendOrder(page);
    await sleep(10000);

    const giftCardCodes = await getCodeFromMail();
    if (!giftCardCodes) {
      throw new Error('Gift card codes not found.');
    }
    await page.goto(woltRedeemCodeUrl);
    await redeemGiftCard(page, giftCardCodes);
    // Use the gift card codes as needed



    console.log('Order placed successfully!');
  } catch (error) {
    console.error('Error during automation:', error.message);
    await sendErrorEmail('Automation Error with Wolt Gift Card', `An error occurred: ${error.message}`);
} finally {
    await browser.close();
  }
})();
