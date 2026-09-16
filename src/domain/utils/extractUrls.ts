const URL_PATTERN = /https?:\/\/[^\s]+/g;

function extractUrls(text) {
  if (!text) return [];
  const matches = text.match(URL_PATTERN);
  return matches ? matches.map((url) => url.replace(/[.,;:!?)]+$/, '')) : [];
}

export { extractUrls };
