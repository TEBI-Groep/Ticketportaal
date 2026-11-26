/**
 * Turn Missive HTML body into a plain-text ticket update, dropping quoted
 * reply history and common signature blocks when possible.
 */
export function htmlEmailToCommentText(html: string | null | undefined): string {
  if (!html) return "";
  // Remove signature / quote wrappers in HTML before stripping tags.
  let cleaned = html
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "\n")
    .replace(/<div[^>]*class="[^"]*gmail_quote[^"]*"[\s\S]*$/gi, "\n")
    .replace(/<div[^>]*(?:id|class)="[^"]*[Ss]ignature[^"]*"[\s\S]*$/gi, "\n")
    .replace(
      /<div[^>]*class="[^"]*(?:ms-outlook-signature|OutlookMessageHeader)[^"]*"[\s\S]*$/gi,
      "\n",
    )
    // Missive / Outlook editable signature tables.
    .replace(/<table[^>]*data-missive-editable[^>]*>[\s\S]*$/gi, "\n")
    // Horizontal rule often separates reply from quoted mail / signature.
    .replace(/<hr[\s\S]*$/gi, "\n");

  let text = cleaned
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

/**
 * Remove typical reply/forward tails and Dutch/English email signatures
 * from plain text (also used for Missive preview fallback).
 */
export function stripQuotedReply(text: string): string {
  const patterns = [
    // Quote / forward markers
    /\nOn .+wrote:\s*$/im,
    /\nOp .+schreef .+:\s*$/im,
    /\nFrom:\s.+$/im,
    /\nVan:\s.+$/im,
    /\n-{2,}\s*Original Message\s*-{2,}/im,
    /\n-{2,}\s*Oorspronkelijk bericht\s*-{2,}/im,
    /\n-{5,}Forwarded message-{5,}/im,
    /\n_{5,}\s*$/im,
    // RFC 3676 signature delimiter (space optional — many clients omit it)
    /\n--\s*\n/,
    // Common NL/EN closings that start a signature block
    /\nMet vriendelijke groet[en]?,?\s*$/im,
    /\nHartelijke groet[en]?,?\s*$/im,
    /\nVriendelijke groet[en]?,?\s*$/im,
    /\nKind regards?,?\s*$/im,
    /\nBest regards?,?\s*$/im,
    /\nWith kind regards?,?\s*$/im,
    /\nRegards?,?\s*$/im,
    // Mobile / client footers
    /\nSent from my .+$/im,
    /\nVerstuurd vanaf mijn .+$/im,
    /\nGet Outlook for .+$/im,
    // Tebi IT signature remnant (when quote strip missed the HTML table)
    /\nVolg ons ook op social media/im,
    /\nAfdeling IT\s*$/im,
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
