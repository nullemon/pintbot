// DEFAULT/seed site list. On first run these are copied into the editable
// `site_configs` table in the database; after that you manage sites entirely
// from the admin dashboard (Sites tab) — you don't need to edit this file.
// This just provides the initial examples.
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
