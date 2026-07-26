const { SendMailClient } = require("zeptomail");

// Load dotenv if not already loaded (e.g. during standalone testing)
if (!process.env.ZEPTOMAIL_TOKEN) {
  const path = require('path');
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}

const extractErrorMessage = (err) => {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.error && err.error.message) return err.error.message;
  if (err.message) return err.message;
  return JSON.stringify(err);
};

async function retryWithBackoff(fn, maxAttempts = 3, initialDelayMs = 1000) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts) {
        throw err;
      }
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      console.log(`[Email Node] Attempt ${attempt} failed: ${extractErrorMessage(err)}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

module.exports = {
  type: 'email',

  async execute(ctx) {
    const { config } = ctx;
    const { to, subject, message, replyTo, cc, bcc } = config;

    if (!to) {
      throw new Error('Recipient email (To) is required.');
    }
    if (!subject) {
      throw new Error('Email subject is required.');
    }
    if (!message) {
      throw new Error('Email message body is required.');
    }

    const token = process.env.ZEPTOMAIL_TOKEN;
    const url = process.env.ZEPTOMAIL_API_URL || "https://api.zeptomail.in/v1.1/email";
    const fromAddress = process.env.ZEPTOMAIL_FROM_ADDRESS || "noreply@getlostleads.com";
    const fromName = process.env.ZEPTOMAIL_FROM_NAME || "noreply";

    if (!token) {
      throw new Error('ZEPTOMAIL_TOKEN is not configured in the server environment.');
    }

    const client = new SendMailClient({ url, token });

    // Helper to parse comma-separated emails into Zeptomail address structure
    const parseEmails = (str) => {
      if (!str) return [];
      return str.split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0)
        .map(email => ({
          email_address: {
            address: email
          }
        }));
    };

    // Helper to parse reply-to emails
    const parseReplyTo = (str) => {
      if (!str) return [];
      return str.split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0)
        .map(email => ({
          address: email
        }));
    };

    const mailOptions = {
      from: {
        address: fromAddress,
        name: fromName
      },
      to: parseEmails(to),
      subject: subject,
      htmlbody: message
    };

    if (cc) {
      mailOptions.cc = parseEmails(cc);
    }
    if (bcc) {
      mailOptions.bcc = parseEmails(bcc);
    }
    if (replyTo) {
      mailOptions.reply_to = parseReplyTo(replyTo);
    }

    const sendRequest = async () => {
      console.log(`[Email Node] Dispatching email to: ${to}, subject: "${subject}"`);
      const response = await client.sendMail(mailOptions);
      
      if (!response) {
        throw new Error('Received empty response from Zoho Zeptomail');
      }

      // Check if response resolved but indicates failure
      if (response.error) {
        throw response; // Throw the error payload so retry block catches it
      }

      if (!response.request_id) {
        throw new Error('Zoho Zeptomail accepted request but returned no request_id');
      }

      return response;
    };

    try {
      const response = await retryWithBackoff(sendRequest, 3, 1000);
      console.log('[Email Node] Email sent successfully:', JSON.stringify(response));
      return {
        success: true,
        messageId: response.message_id || response.request_id || null,
        data: response
      };
    } catch (error) {
      const errMsg = extractErrorMessage(error);
      console.error('[Email Node] Failed to send email via Zoho Zeptomail after all attempts:', errMsg);
      throw new Error(`Zoho Zeptomail Error: ${errMsg}`);
    }
  }
};