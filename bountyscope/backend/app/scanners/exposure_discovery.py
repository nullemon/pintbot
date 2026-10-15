"""Small transparent directory seed set, only for explicitly selected Exposure scans."""

from urllib.parse import urlsplit

from app.scanners.base import once, origin, permitted

DIRECTORY_SEEDS = (
    "/images/",
    "/image/",
    "/img/",
    "/thumbnails/",
    "/thumb/",
    "/media/",
    "/uploads/",
    "/files/",
    "/assets/",
    "/cdn/",
    "/wp-content/",
    "/wp-content/uploads/",
)


class ExposureDirectoryDiscovery:
    name = "exposure_directory_discovery"
    category = "Directory discovery"

    async def scan(self, ctx, page):
        if ctx.profile != "exposure" or not once(ctx, "exposure_directories:" + origin(page.url)):
            return []
        admitted = 0
        for path in DIRECTORY_SEEDS:
            url = origin(page.url) + path
            if permitted(ctx, url) and await ctx.remember_url(url, "scanner:directory"):
                admitted += 1
        ctx.event(
            "exposure_directory_candidates",
            {
                "hostname": urlsplit(page.url).hostname,
                "candidates_added": admitted,
                "candidate_limit": len(DIRECTORY_SEEDS),
                "reason": "Bounded common directory checks; listing signatures are required before reporting exposure",
            },
        )
        return []
