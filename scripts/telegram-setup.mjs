/**
 * One-off bot setup, run after creating the bot in @BotFather and adding it
 * to the group as an admin (with "Invite users", "Delete messages" and, if
 * the group has topics, "Manage topics").
 *
 *   node --env-file=.env.local scripts/telegram-setup.mjs https://your-domain
 *
 * Needs TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_ID and TELEGRAM_WEBHOOK_SECRET.
 * It:
 *  1. points the bot's webhook at https://your-domain/api/telegram/webhook,
 *     with the secret, for private messages and group join requests only;
 *  2. creates the group's invite link that only makes join requests (so the
 *     bot can check each person) and prints it: put it in
 *     TELEGRAM_GROUP_INVITE_LINK.
 *
 * Without a domain it only prints what the bot can see, to check the setup.
 */
const token = process.env.TELEGRAM_BOT_TOKEN;
const group = process.env.TELEGRAM_GROUP_ID;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const domain = process.argv[2]?.replace(/\/$/, "");

if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN first.");
  process.exit(1);
}

async function call(method, params = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = await response.json();
  if (!body.ok) throw new Error(`${method}: ${body.description}`);
  return body.result;
}

const me = await call("getMe");
console.log(`Bot: @${me.username}`);

if (group) {
  const chat = await call("getChat", { chat_id: group });
  console.log(`Group: ${chat.title} (${chat.is_forum ? "has topics" : "no topics"})`);
  const self = await call("getChatMember", { chat_id: group, user_id: me.id });
  console.log(`Bot in group: ${self.status}`,
    self.status === "administrator"
      ? `· invite: ${self.can_invite_users} · delete: ${self.can_delete_messages}`
      : "· make it an admin");
} else {
  console.log("TELEGRAM_GROUP_ID isn't set: add the bot to the group, then get the id from @RawDataBot or similar.");
}

if (!domain) {
  console.log("\nNo domain given: nothing changed.");
  process.exit(0);
}
if (!secret || !group) {
  console.error("Set TELEGRAM_WEBHOOK_SECRET and TELEGRAM_GROUP_ID before setting the webhook.");
  process.exit(1);
}

await call("setWebhook", {
  url: `${domain}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ["message", "chat_join_request"],
});
console.log(`Webhook: ${domain}/api/telegram/webhook`);

const link = await call("createChatInviteLink", {
  chat_id: group, name: "SimbaCasa members", creates_join_request: true,
});
console.log(`\nInvite link (put in TELEGRAM_GROUP_INVITE_LINK):\n${link.invite_link}`);
