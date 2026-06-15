/**
 * Centralized backend extensions for Activepieces pieces.
 * Handles custom actions requested by the frontend.
 */
const PIECES_EXTENSIONS = {
  telegram_bot: {
    /**
     * Fetch the bot's username dynamically using the TELEGRAM_BOT_TOKEN
     */
    getBotInfo: async (payload, context) => {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        console.warn('[Telegram Custom Action] TELEGRAM_BOT_TOKEN is not defined in environment');
        return { username: null };
      }
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const data = await res.json();
        if (data.ok && data.result) {
          return { username: data.result.username };
        }
      } catch (err) {
        console.error('[Telegram Custom Action] getBotInfo failed:', err);
      }
      return { username: null };
    },

    /**
     * Detect the Telegram chat ID associated with a unique startup code.
     * Queries Redis first (populated by webhook), falling back to Telegram getUpdates polling.
     */
    detectChatId: async (payload, context) => {
      const { code } = payload;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken || !code) {
        return { chatId: null };
      }

      const redis = context.redis;
      const cacheKey = `tg_code:${code}`;

      // 1. Try Redis lookup first (Production Webhook Mode)
      if (redis) {
        try {
          const cachedChatId = await redis.get(cacheKey);
          if (cachedChatId) {
            console.log(`[Telegram Custom Action] Cache hit for code "${code}": ${cachedChatId}`);
            return { chatId: cachedChatId };
          }
        } catch (err) {
          console.error('[Telegram Custom Action] Redis read error:', err);
        }
      }

      // 2. Fallback to /getUpdates polling (Local/Development Mode)
      console.log(`[Telegram Custom Action] Cache miss, polling Telegram updates for code: "${code}"`);
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=50&offset=-50`);
        const data = await res.json();
        if (data.ok && data.result) {
          for (const update of data.result) {
            const message = update.message || update.edited_message;
            if (!message) continue;

            const text = message.text || '';
            if (text.startsWith('/start ') && text.includes(code)) {
              const chatId = message.chat.id;
              console.log(`[Telegram Custom Action] Detected Chat ID ${chatId} from updates polling`);

              // Cache in Redis if available
              if (redis) {
                await redis.set(cacheKey, chatId, 'EX', 600); // 10 minutes expiry
              }
              return { chatId };
            }
          }
        }
      } catch (err) {
        console.error('[Telegram Custom Action] /getUpdates polling failed:', err);
      }

      return { chatId: null };
    }
  }
};

module.exports = PIECES_EXTENSIONS;
