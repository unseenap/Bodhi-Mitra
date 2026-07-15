type OtpEmailOptions = {
  otp: string;
  expiresInMinutes: number;
  campusHotlineLabel: string;
  campusHotlineNumber: string;
};

export function createOtpEmail({ otp, expiresInMinutes, campusHotlineLabel, campusHotlineNumber }: OtpEmailOptions) {
  const spacedOtp = otp.split("").join(" ");

  return {
    subject: `${otp} is your Bodhi-Mitra sign-in code`,
    text: [
      "Bodhi-Mitra sign-in verification",
      "",
      `Your verification code is: ${otp}`,
      `This code expires in ${expiresInMinutes} minutes and can only be used once.`,
      "",
      "If you did not request this code, you can safely ignore this email. Never share this code with anyone.",
      "",
      `Need immediate campus support? ${campusHotlineLabel}: ${campusHotlineNumber}`,
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Bodhi-Mitra verification code</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f3ff;color:#312e81;font-family:Arial,'Helvetica Neue',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your Bodhi-Mitra code is ${otp}. It expires in ${expiresInMinutes} minutes.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f5f3ff;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #ddd6fe;border-radius:20px;overflow:hidden;box-shadow:0 16px 40px rgba(76,29,149,.10);">
            <tr>
              <td style="height:7px;background:#7c3aed;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 36px 18px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;border-radius:14px;background:#7c3aed;color:#ffffff;font-size:18px;font-weight:800;">BM</td>
                    <td style="padding-left:14px;">
                      <div style="font-size:20px;line-height:26px;font-weight:800;color:#312e81;">Bodhi-Mitra</div>
                      <div style="font-size:12px;line-height:18px;color:#6b5b95;">Your campus mind-mate</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 36px 36px;">
                <div style="font-size:12px;line-height:18px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#7c3aed;">Secure sign-in</div>
                <h1 style="margin:10px 0 12px;font-size:30px;line-height:38px;color:#312e81;">Your verification code</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:25px;color:#6b5b95;">Enter this one-time code on the Bodhi-Mitra sign-in screen. It can only be used once.</p>
                <div aria-label="Verification code ${otp}" style="padding:22px 12px;border:1px solid #c4b5fd;border-radius:16px;background:#f5f3ff;text-align:center;color:#4c1d95;font-family:'Courier New',monospace;font-size:34px;line-height:42px;font-weight:800;letter-spacing:6px;">${spacedOtp}</div>
                <p style="margin:14px 0 0;text-align:center;font-size:13px;line-height:20px;color:#6b5b95;">Expires in <strong style="color:#4c1d95;">${expiresInMinutes} minutes</strong></p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;width:100%;background:#faf9ff;border-radius:14px;">
                  <tr>
                    <td style="padding:18px 20px;border-left:4px solid #7c3aed;border-radius:14px;">
                      <div style="font-size:14px;line-height:21px;font-weight:700;color:#312e81;">Keep your account safe</div>
                      <div style="margin-top:4px;font-size:13px;line-height:20px;color:#6b5b95;">Bodhi-Mitra staff will never ask you to share this code. If you did not request it, simply ignore this email.</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 36px;background:#312e81;color:#ffffff;">
                <div style="font-size:13px;line-height:20px;font-weight:700;">Need immediate support?</div>
                <div style="margin-top:3px;font-size:12px;line-height:19px;color:#ddd6fe;">${campusHotlineLabel}: <a href="tel:${campusHotlineNumber.replace(/\s/g, "")}" style="color:#ffffff;text-decoration:none;font-weight:700;">${campusHotlineNumber}</a></div>
              </td>
            </tr>
          </table>
          <p style="margin:18px auto 0;max-width:540px;font-size:11px;line-height:17px;color:#76669e;text-align:center;">This automated message was sent for a Bodhi-Mitra account sign-in. Please do not reply.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
