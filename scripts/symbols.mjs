// Groups for everything that isn't a plain A–Z / 0–9 character.
// An icon joins a group when its character is listed, or its achievement name matches the word test
// (so an icon named "Star" lands in Stars even though its name isn't "★").

export const GROUPS = [
  { id: "stars",     label: "Stars",               chars: "★☆⭐✦✧✩✪✫✬✭✮✯✰🌟✨", words: /\bstars?\b|\bsparkle/i },
  { id: "hearts",    label: "Hearts",              chars: "♥❤♡💜💙💚💛🧡🖤🤍💗💖💕💓💘❣", words: /\bhearts?\b|\blove\b/i },
  { id: "money",     label: "Money signs",         chars: "$€£¥¢₽₹₩₿¤", words: /\b(money|dollars?|coins?|cash|euro|pounds?|yen|gold coin)\b/i },
  { id: "crowns",    label: "Crowns",              chars: "♔♕♚♛👑", words: /\bcrowns?\b|\bking\b|\bqueen\b/i },
  { id: "arrows",    label: "Arrows",              chars: "←↑→↓↖↗↘↙↔↕⇐⇒⇑⇓➜➔➡⬅⬆⬇➤▶◀", words: /\barrows?\b/i },
  { id: "smileys",   label: "Smileys and faces",   chars: "☺☹☻🙂🙁😐😀😃😄😊😉😎😢😡🤔😍", words: /\b(smil\w*|smiley|laugh\w*|happy|sad|wink\w*|kiss\w*|outrage|emoji|face|lipped|astray|closed mouth|do not understand)\b/i },
  { id: "music",     label: "Music",               chars: "♪♫♩♬🎵🎶🎼", words: /\b(music|musical|notes?|melody)\b/i },
  { id: "checks",    label: "Checks and crosses",  chars: "✓✔✗✘✖❌❎☑☒", words: /\b(check|tick|checkmark)\b/i },
  { id: "shapes",    label: "Shapes",              chars: "■□▲△▼▽◆◇●○⬤⭕◯⯁▪▫◼◻⬛⬜♦♢◈▣▤▥▦▧▨▩", words: /\b(circle|square|triangle|diamond|rhombus|hexagon|block)\b/i },
  { id: "cards",     label: "Card suits",          chars: "♠♣♥♦♤♧♡♢", words: /\b(spades?|clubs?|trump|suit)\b/i },
  { id: "sky",       label: "Sun, moon and weather", chars: "☀☼🌣☾☽🌙☁⚡❄☂☃🌈", words: /\b(sun|sunny|moon|cloud|snow\w*|lightning|rain\w*|weather)\b/i },
  { id: "danger",    label: "Skulls and danger",   chars: "☠☢☣⚠💀💣🚫🛇⛔", words: /\b(skull|radiation|biohazard|danger|bomb|dinamit|dynamite|warning)\b/i },
  { id: "signs",     label: "Signs and symbols",   chars: "☯☮☪✝☦✡☸⚛♻©®™°§¶∞≈≠±÷×✿❀❁✾❦❧⚜", words: /\b(yin|yang|peace|infinity|recycle|copyright|flower)\b/i },
  { id: "items",     label: "Objects and icons",   chars: "🏠🎮🏆🔥💎🔑🔒📷💾🎁⚙🔔", words: /\b(cup|trophy|achievement|fire|flame|gem|key|lock|camera|save|gift|gear|bell|sound|like)\b/i },
];
export const PUNCTUATION = "!?.,:;'\"-_+=*&#%@/\\|()[]{}<>~^`";

export function scriptOf(ch) {
  const c = ch.codePointAt(0);
  if (c >= 0x0400 && c <= 0x04ff) return "cyrillic";
  if (c >= 0x0370 && c <= 0x03ff) return "greek";
  if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3040 && c <= 0x30ff) || (c >= 0x3400 && c <= 0x4dbf)) return "cjk";
  if (c >= 0xac00 && c <= 0xd7af) return "korean";
  if (c >= 0x0590 && c <= 0x06ff) return "hebrew-arabic";
  if (/\p{L}/u.test(ch) && !/[A-Z]/.test(ch)) return "other-letters";
  return null;
}
export const SCRIPTS = {
  cyrillic: "Cyrillic (Russian, Ukrainian…)", greek: "Greek", cjk: "Chinese and Japanese", korean: "Korean",
  "hebrew-arabic": "Hebrew and Arabic", "other-letters": "Accented and other letters",
};

// Which groups an icon belongs to. ch = tagged character (or null), name = achievement name.
export function groupsFor(ch, name) {
  const out = [];
  for (const g of GROUPS) {
    if ((ch && g.chars.includes(ch)) || (name && name.length <= 40 && g.words.test(name))) out.push(g.id);
  }
  if (ch && PUNCTUATION.includes(ch)) out.push("punct:" + ch);
  if (ch) { const s = scriptOf(ch); if (s) out.push("script:" + s); }
  return out;
}
