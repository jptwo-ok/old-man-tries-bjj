const BOT_UA_PATTERN =
  /bot|crawler|spider|facebookexternalhit|slackbot|discordbot|whatsapp|telegrambot|twitterbot|linkedinbot|embedly|quora link preview|pinterest|vkshare|w3c_validator|googlebot|bingbot|ia_archiver|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bytespider|google-inspectiontool|applebot|yandexbot|duckduckbot|uptimerobot|pingdom|headlesschrome|phantomjs/i;

// No user-agent at all is itself a strong bot signal (real browsers always send one).
export function isBot(userAgent) {
  if (!userAgent) return true;
  return BOT_UA_PATTERN.test(userAgent);
}
