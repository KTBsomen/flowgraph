export const PIECES_OVERRIDES = {
  telegram_bot: {
    // 1. Piece-level auth configuration
    auth: {
      allowCustom: true,
      customLabel: "Use Custom Bot Token",
      globalLabel: "Connected via system Telegram Bot"
    },
    // 2. Piece-level custom fields (rendered according to layout order)
    fields: {
      telegram_connect_guide: {
        type: 'custom_html',
        html: `
          <div class="wf-custom-guide-card" style="background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 6px; padding: 12px; margin-bottom: 12px; font-size: 12px; color: #e2e8f0; line-height: 1.5;">
            <strong style="color: #818cf8; display: block; margin-bottom: 4px;">🔌 How to Connect:</strong>
            1. Click the button below to start a chat with our bot:
            <div style="margin: 8px 0 10px 0;">
              <button type="button" class="wf-btn wf-telegram-bot-link-btn" style="padding: 6px 12px; font-size: 11px; background: #0088cc; border: none; display: inline-flex; align-items: center; gap: 6px; color: white; border-radius: 4px; cursor: pointer; font-weight: 500;">
                💬 Open Telegram Bot
              </button>
            </div>
            2. Click <strong>Start</strong> in Telegram, then click <strong>Get Chat ID</strong> here.
            <button type="button" class="wf-btn wf-telegram-detect-btn" style="width: 100%; margin-top: 8px; padding: 6px; font-size: 11px; background: #1e293b; border: 1px solid #334155; color: #cbd5e1; border-radius: 4px; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 6px; font-weight: 500;">
              🔄 Get Chat ID
            </button>
          </div>
        `,
        onRender: (el, ctx) => {
          const linkBtn = el.querySelector('.wf-telegram-bot-link-btn');
          const detectBtn = el.querySelector('.wf-telegram-detect-btn');
          
          if (!ctx.node._telegramStartCode) {
            ctx.node._telegramStartCode = Math.random().toString(36).substring(2, 8);
          }
          const startCode = ctx.node._telegramStartCode;

          ctx.apiCall('/api/pieces/custom-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pieceName: 'telegram_bot', actionName: 'getBotInfo' })
          })
          .then(r => r.json())
          .then(data => {
            if (data.username && linkBtn) {
              linkBtn.addEventListener('click', () => {
                window.open(`https://t.me/${data.username}?start=${startCode}`, '_blank');
              });
            }
          })
          .catch(err => console.error('[Telegram Override] getBotInfo failed:', err));

          if (detectBtn) {
            detectBtn.addEventListener('click', async () => {
              detectBtn.disabled = true;
              detectBtn.innerText = 'Detecting...';
              try {
                const res = await ctx.apiCall('/api/pieces/custom-action', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    pieceName: 'telegram_bot',
                    actionName: 'detectChatId',
                    payload: { code: startCode }
                  })
                });
                const data = await res.json();
                if (data.chatId) {
                  ctx.setFieldValue('chat_id', data.chatId);
                  detectBtn.innerHTML = '✓ Detected!';
                  ctx.toast('Telegram Chat ID detected successfully!', 'success');
                  setTimeout(() => {
                    detectBtn.innerHTML = '🔄 Get Chat ID';
                    detectBtn.disabled = false;
                  }, 2000);
                } else {
                  ctx.toast('Could not find recent message. Make sure you clicked "Start" in Telegram.', 'error');
                  detectBtn.innerText = '🔄 Get Chat ID';
                  detectBtn.disabled = false;
                }
              } catch (e) {
                ctx.toast('Error: ' + e.message, 'error');
                detectBtn.innerText = '🔄 Get Chat ID';
                detectBtn.disabled = false;
              }
            });
          }
        }
      }
    },
    // 3. Top-level layout ordering of the panel sections/fields
    order: ['telegram_connect_guide', 'actionName', '*actionFields*'],
    
    // 4. Action-specific configurations
    actions: {
      send_text_message: {
        order: ['chat_id', 'message'],
        fields: {
          chat_id: {
            label: "Chat ID",
            placeholder: "Enter Chat ID or use auto-detect...",
            required: true,
            description: "Unique identifier for user, group, or channel.",
            help: {
              text: "To find your Telegram Chat ID, start a conversation with our bot or @userinfobot. For groups/channels, add the bot as an admin and retrieve the group's chat ID (usually begins with a minus sign like -100123456789)."
            },
            validate: (val) => {
              if (!/^-?\d+$/.test(val) && !val.startsWith('@')) {
                return "Chat ID must be a number or start with @";
              }
              return null;
            }
          },
          message: {
            label: "Message Text",
            placeholder: "Type your message here...",
            required: true,
            description: "The body of the message to send."
          }
        }
      }
    }
  },
  slack: {
    auth: {
      allowCustom: true,
      customLabel: "Use Custom Bot Token (starts with xoxb-)",
      globalLabel: "Authorize with system Slack App"
    },
    order: ['actionName', '*actionFields*'],
    actions: {
      send_channel_message: {
        order: ['channel', 'text'],
        fields: {
          channel: {
            label: "Slack Channel",
            placeholder: "Select a channel...",
            description: "Choose the target channel in your workspace."
          },
          text: {
            label: "Message Text",
            placeholder: "Type message or format using block kit...",
            description: "Message content. Markdown formatting is supported."
          }
        }
      }
    }
  }
};
