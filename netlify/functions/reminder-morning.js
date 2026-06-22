const { schedule } = require("@netlify/functions");
const { sendReminder } = require("./_send-reminder");

exports.handler = schedule("45 4 * * *", async () => {
  const result = await sendReminder("morning");
  console.log("[scheduled] result", result);
  return { statusCode: 200, body: JSON.stringify(result) };
});
