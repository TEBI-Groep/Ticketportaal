/**
 * Turn Missive HTML body into a plain-text ticket update, dropping quoted
 * reply history and common signature separators when possible.
 */
export function htmlEmailToCommentText(html: string | null | undefined): string {
  if (!html) return "";
  let text = html
    // Drop blockquotes / gmail quote wrappers before stripping tags.
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "\n")
    .replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[\s\S]*$/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  text = stripQuotedReply(text);
  // Collapse excess blank lines / trailing space.
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Remove typical reply/forward tails from plain text. */
export function stripQuotedReply(text: string): string {
  const patterns = [
    /\nOn .+wrote:\s*$/im,
    /\nOp .+schreef .+:\s*$/im,
    /\nFrom:\s.+$/im,
    /\nVan:\s.+$/im,
    /\n-{2,}\s*Original Message\s*-{2,}/im,
    /\n-{5,}Forwarded message-{5,}/im,
    /\n-- \n/, // standard signature delimiter
  ];

  let cut = text.length;
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.index != null && match.index < cut) {
      cut = match.index;
    }
  }
  return text.slice(0, cut).trim();
}
