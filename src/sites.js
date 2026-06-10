// Site list: RSS url, REST base, board map, niche, hashtags.
// Fill in defaultBoardId with a real Pinterest board id (run `npm run boards`
// after OAuth to list them, then paste the id here).
export const SITES = [
  {
    name: "otakukart",
    rss: "https://otakukart.com/feed/",
    restBase: "https://otakukart.com/wp-json/wp/v2",
    niche: "anime",
    defaultBoardId: "PUT_BOARD_ID",
    hashtags: ["#anime", "#manga", "#onepiece"],
    // overlayTitle: composite the article title onto the image (default true)
    overlayTitle: true,
  },
  {
    name: "daxstreet",
    rss: "https://daxstreet.com/feed/",
    restBase: "https://daxstreet.com/wp-json/wp/v2",
    niche: "automotive",
    defaultBoardId: "PUT_BOARD_ID",
    hashtags: ["#cars", "#automotive", "#trucks"],
    overlayTitle: true,
  },
  // add more sites here
];

export function getSite(name) {
  return SITES.find((s) => s.name === name);
}
