// Plain inline-HTML mail bodies (COT-151). Branding is out of scope until
// the seam works (CLAUDE.md) — these are deliberately unstyled beyond what
// keeps them legible in a mail client.

function layout(bodyHtml: string): string {
  return `<div style="font-family: system-ui, sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.5;">${bodyHtml}</div>`;
}

function button(url: string, label: string): string {
  return `<p><a href="${url}" style="display: inline-block; background: #111; color: #fff; padding: 10px 16px; text-decoration: none;">${label}</a></p>`;
}

export function inviteMailBody(inviteUrl: string): string {
  return layout(`
    <p>You've been invited to khaos-id.</p>
    ${button(inviteUrl, "Accept invite")}
    <p>This link expires in 7 days. If it expires, ask root to resend it.</p>
  `);
}

export function confirmRequestMailBody(confirmUrl: string): string {
  return layout(`
    <p>Confirm your email to finish your khaos-id access request.</p>
    ${button(confirmUrl, "Confirm email")}
    <p>If you didn't request access, you can ignore this email.</p>
  `);
}

export function notifyRootMailBody(
  reviewUrl: string,
  requester: { email: string; name: string; surname: string },
): string {
  return layout(`
    <p>A visitor request is pending review.</p>
    <p>${requester.name} ${requester.surname} &lt;${requester.email}&gt;</p>
    ${button(reviewUrl, "Review request")}
  `);
}

export function activateVisitorMailBody(activateUrl: string): string {
  return layout(`
    <p>Your khaos-id access request was approved.</p>
    ${button(activateUrl, "Set your password")}
    <p>This link expires in 7 days.</p>
  `);
}

export function resetTriggeredMailBody(resetUrl: string): string {
  return layout(`
    <p>An admin triggered a password reset for your khaos-id account.</p>
    ${button(resetUrl, "Choose a new password")}
    <p>If you didn't expect this, contact root.</p>
  `);
}

export function confirmEmailChangeMailBody(confirmUrl: string): string {
  return layout(`
    <p>Confirm this address to finish changing your khaos-id email.</p>
    ${button(confirmUrl, "Confirm new email")}
    <p>Your current email stays active until you confirm. If you didn't request this, you can ignore this email.</p>
  `);
}
