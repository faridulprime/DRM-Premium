/**
 * DRM Premium Owner OTP mailer.
 * Deploy as a Web App: Execute as Me; Who has access: Anyone.
 * Set Script Properties: DRM_OTP_TOKEN and OWNER_EMAIL.
 */
function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const expectedToken = props.getProperty("DRM_OTP_TOKEN") || "";
    const ownerEmail = (props.getProperty("OWNER_EMAIL") || "").trim().toLowerCase();
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const suppliedToken = String(body.token || "");
    const recipient = String(body.to || "").trim().toLowerCase();
    const code = String(body.code || "");
    const type = String(body.type || "owner-verification");

    if (!expectedToken || suppliedToken !== expectedToken) {
      return output({ ok: false, error: "Unauthorized request." });
    }
    if (!ownerEmail || !recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return output({ ok: false, error: "Invalid recipient." });
    }
    if (type === "owner-verification" && recipient !== ownerEmail) {
      return output({ ok: false, error: "Recipient is not the configured Owner email." });
    }
    if (type === "user-registration" && recipient === ownerEmail) {
      return output({ ok: false, error: "The Owner email is reserved." });
    }
    if (!["owner-verification", "user-registration"].includes(type)) {
      return output({ ok: false, error: "Invalid mail purpose." });
    }
    if (!/^\d{6}$/.test(code)) {
      return output({ ok: false, error: "Invalid verification code." });
    }

    const isOwner = type === "owner-verification";
    GmailApp.sendEmail(
      recipient,
      isOwner ? "DRM Premium — Owner verification code" : "DRM Premium — Verify your email",
      (isOwner ? "Your DRM Premium Owner verification code is " : "Your DRM Premium account verification code is ") + code +
        ". It expires in " + Math.min(10, Math.max(1, Number(body.expiresInMinutes) || 10)) + " minutes. If you did not request this, ignore this email."
    );
    return output({ ok: true });
  } catch (err) {
    console.error(err);
    return output({ ok: false, error: "Email delivery failed." });
  }
}

function output(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
