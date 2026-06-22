const { schedule } = require("@netlify/functions");
const { sendReminder } = require("./_send-reminder");

exports.handler = schedule("0 10 * * *", async () => {
  const result = await sendReminder("day");
  console.log("[scheduled] result", result);
  return { statusCode: 200, body: JSON.stringify(result) };
});
