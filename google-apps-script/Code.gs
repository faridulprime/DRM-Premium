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
    const purpose = isOwner ? "Owner account verification" : "Email address verification";
    const subject = isOwner
      ? "Your DRM– Premium Owner verification code"
      : "Your DRM– Premium verification code";
    const expiryMinutes = Math.min(10, Math.max(1, Number(body.expiresInMinutes) || 10));
    const plainBody =
      "DRM– Premium\n\n" +
      purpose + "\n\n" +
      "Your verification code is: " + code + "\n\n" +
      "This code expires in " + expiryMinutes + " minutes.\n\n" +
      "Your journey forward starts with DRM– Premium.\n\n" +
      "— DRM– Premium";

    const htmlBody =
      '<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#17202a;">' +
      '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e9ef;border-radius:12px;padding:32px;">' +
      '<div style="font-size:20px;font-weight:700;letter-spacing:.2px;color:#17202a;">DRM– <span style="color:#3978c6;">Premium</span></div>' +
      '<div style="margin-top:28px;font-size:18px;font-weight:700;">' + purpose + '</div>' +
      '<p style="margin:12px 0 20px;color:#52606d;line-height:1.6;">Use the verification code below to continue. It is valid for ' + expiryMinutes + ' minutes.</p>' +
      '<div style="padding:18px 12px;border:1px solid #dce5ef;border-radius:8px;background:#f7f9fc;text-align:center;font-size:30px;font-weight:700;letter-spacing:8px;color:#17202a;">' + code + '</div>' +
      '<p style="margin:20px 0 0;color:#52606d;font-size:13px;line-height:1.6;">Your journey forward starts with DRM– Premium.</p>' +
      '</div></body></html>';

    GmailApp.sendEmail(recipient, subject, plainBody, {
      htmlBody: htmlBody,
      name: "DRM– Premium"
    });
    console.info("OTP email accepted by Gmail for " + recipient + " (" + type + ").");
    return output({ ok: true });
  } catch (err) {
    console.error("OTP email send failed: " + String(err && err.message ? err.message : err));
    return output({ ok: false, error: "Email delivery failed." });
  }
}

function output(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
