/**
 * DRM– Premium email service.
 * Deploy as a Web App: Execute as Me; Who has access: Anyone.
 * Script Properties: DRM_OTP_TOKEN, OWNER_EMAIL.
 */
function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const expectedToken = props.getProperty("DRM_OTP_TOKEN") || "";
    const ownerEmail = (props.getProperty("OWNER_EMAIL") || "").trim().toLowerCase();
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const suppliedToken = String(body.token || "");
    const recipient = String(body.to || "").trim().toLowerCase();
    const type = String(body.type || "owner-verification");

    if (!expectedToken || suppliedToken !== expectedToken) {
      return output({ ok: false, error: "Unauthorized request." });
    }
    if (!ownerEmail || !recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return output({ ok: false, error: "Invalid recipient." });
    }

    if (type === "account-suspended") {
      if (recipient === ownerEmail) {
        return output({ ok: false, error: "The Owner account cannot be suspended." });
      }
      const expiresAt = Number(body.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
        return output({ ok: false, error: "Invalid suspension expiry." });
      }
      const expiry = new Date(expiresAt * 1000);
      const expiryText = Utilities.formatDate(expiry, Session.getScriptTimeZone(), "dd MMM yyyy, hh:mm a z");
      const reason = String(body.reason || "").trim().slice(0, 500);
      const subject = "DRM– Premium account temporarily suspended";
      const plainBody =
        "DRM– Premium\n\n" +
        "Your account has been temporarily suspended for 24 hours.\n\n" +
        "Access will be restored automatically after: " + expiryText + "\n" +
        (reason ? "Reason: " + reason + "\n" : "") +
        "\nDuring this period, access to DRM– Premium is unavailable. The website will display the remaining suspension time.\n\n" +
        "If you believe this action was made in error, contact the website administrator.\n\n" +
        "— DRM– Premium";
      const safeReason = escapeHtml(reason);
      const htmlBody =
        '<!doctype html><html><body style="margin:0;padding:32px 16px;background:#101318;font-family:Arial,Helvetica,sans-serif;color:#e8edf3;">' +
        '<div style="max-width:540px;margin:0 auto;background:#191f27;border:1px solid #343e4b;border-radius:12px;padding:32px;">' +
        '<div style="font-size:20px;font-weight:700;letter-spacing:.2px;color:#f4f6f8;">DRM– <span style="color:#9bb9db;">Premium</span></div>' +
        '<div style="height:1px;background:#35404d;margin:24px 0;"></div>' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#d4ad79;">ACCOUNT NOTICE</div>' +
        '<h2 style="margin:12px 0;color:#f3f5f8;font-size:22px;line-height:1.35;">Your account is temporarily suspended</h2>' +
        '<p style="color:#b7c1cd;font-size:14px;line-height:1.7;">Access to your DRM– Premium account has been suspended for 24 hours. It will be restored automatically after the time shown below.</p>' +
        '<div style="margin:22px 0;padding:18px;border:1px solid #3b4654;border-radius:8px;background:#11161c;">' +
        '<div style="font-size:10px;letter-spacing:1.4px;color:#91a0b0;">ACCESS RESTORES</div>' +
        '<div style="margin-top:8px;font-size:18px;font-weight:700;color:#f0f3f7;">' + escapeHtml(expiryText) + '</div>' +
        '</div>' +
        (reason ? '<div style="margin:0 0 20px;color:#b7c1cd;font-size:13px;line-height:1.6;"><strong style="color:#e1e6ec;">Reason</strong><br>' + safeReason + '</div>' : '') +
        '<p style="margin:0;color:#8f9baa;font-size:12px;line-height:1.7;">During the suspension, the website will show a countdown with the remaining time. If you believe this action was made in error, contact the website administrator.</p>' +
        '<div style="border-top:1px solid #35404d;margin-top:24px;padding-top:16px;color:#8190a0;font-size:11px;">DRM– Premium · Account Security</div>' +
        '</div></body></html>';
      GmailApp.sendEmail(recipient, subject, plainBody, {
        htmlBody: htmlBody,
        name: "DRM– Premium"
      });
      console.info("Suspension notice sent to " + recipient);
      return output({ ok: true });
    }

    const code = String(body.code || "");
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
    const purpose = isOwner ? "Owner account verification" : "DEEPly Researched Method";
    const subject = isOwner
      ? "Your DRM– Premium Owner verification code"
      : "Hello. DRM– Premium is faster than light.";
    const expiryMinutes = Math.min(10, Math.max(1, Number(body.expiresInMinutes) || 10));
    const plainBody =
      "DRM– Premium\n\n" +
      purpose + "\n\n" +
      "Your verification code is: " + code + "\n\n" +
      "Use it Within " + expiryMinutes + " Minutes\n\n" +
      "Your journey forward starts with DRM– Premium.\n\n" +
      "— DRM– Premium";
    const htmlBody =
      '<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#17202a;">' +
      '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e9ef;border-radius:12px;padding:32px;">' +
      '<div style="font-size:20px;font-weight:700;letter-spacing:.2px;color:#17202a;">DRM– <span style="color:#3978c6;">Premium</span></div>' +
      '<div style="margin-top:28px;font-size:18px;font-weight:700;">' + purpose + '</div>' +
      '<p style="margin:12px 0 20px;color:#52606d;line-height:1.6;">Use it Within ' + expiryMinutes + ' Minutes</p>' +
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
    console.error("DRM Premium email send failed: " + String(err && err.message ? err.message : err));
    return output({ ok: false, error: "Email delivery failed." });
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (char) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
  });
}

function output(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
