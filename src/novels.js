const DETAIL_PATH = /^\/detail\/(\d+)\.html$/;
const TITLE_LINK_SELECTOR = '.card.mb-30 .card-title > a[href*="/detail/"]';
const GRID_ITEM_SELECTOR = '.col-lg-3, .col-md-4, .col-sm-3, .col-xs-6';

export function parseNovelLink(link, origin = window.location.origin) {
  const url = new URL(link.href, origin);
  const match = url.pathname.match(DETAIL_PATH);
  if (!match || url.origin !== origin) {
    return null;
  }
  const title = link.textContent.trim();
  if (!title) {
    return null;
  }
  return {
    id: match[1],
    title,
    detailUrl: `${origin}${url.pathname}`
  };
}

export function findNovelCards(root = document) {
  const cards = [];
  for (const link of root.querySelectorAll(TITLE_LINK_SELECTOR)) {
    const novel = parseNovelLink(link);
    const card = link.closest('.card.mb-30');
    if (!novel || !card) {
      continue;
    }
    const parent = card.parentElement;
    const container = parent?.matches(GRID_ITEM_SELECTOR) ? parent : card;
    cards.push({ novel, card, container });
  }
  return cards;
}
