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

    if (!expectedToken || suppliedToken !== expectedToken) {
      return output({ ok: false, error: "Unauthorized request." });
    }
    if (!ownerEmail || recipient !== ownerEmail) {
      return output({ ok: false, error: "Recipient is not the configured Owner email." });
    }
    if (!/^\\d{6}$/.test(code)) {
      return output({ ok: false, error: "Invalid verification code." });
    }

    GmailApp.sendEmail(
      ownerEmail,
      "DRM Premium — Owner verification code",
      "Your DRM Premium Owner verification code is " + code +
        ". It expires in 10 minutes. If you did not request this, ignore this email."
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
