export const sendNotification = async (req, res) => {
  const { type, to, subject, message } = req.body;

  if (!type || !to || !message) {
    return res.status(400).json({ message: "type, to, message required" });
  }

  // TODO: integrate SMS/Email provider
  console.log("Notification:", { type, to, subject, message });

  res.json({ ok: true, message: "Notification sent (mock)" });
};