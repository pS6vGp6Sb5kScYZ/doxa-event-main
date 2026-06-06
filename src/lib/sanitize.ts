import DOMPurify from 'dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p'],
    ALLOWED_ATTR: []
  });
}

export function sanitizeText(text: string): string {
  return text.replace(/[<>]/g, char =>
    char === '<' ? '&lt;' : '&gt;'
  );
}
