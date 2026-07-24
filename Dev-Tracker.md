# Dev Tracker
This file is used by the developer of RosemaryWilliams.art (Agents may use this file in accordance to instructions from the developer.)


# Awaiting

in the art page:
- i want to be able to click to open a large unobstructed view of the art piece.
- get rid of the quotation marks around the titles of the art pieces.

contact info: studio@rosemarywilliams.art is not an email that we have. for now change it to rt3williams@gmail.com

we also need emailing to work so rosemary can get emails about commisions. (look into free email solutions)

on the art page: anytime an artpiece is displayed (it comes from the admin page): make sure the art is displayed in its original aspect ratio.

optimize the art page. I believe the background image is a large file and might take a long time to load, how can we optimize this?

Complete the Cloudflare account setup in BACKEND_SETUP.md (R2, D1, Access,
production variables, and deployment).

# Done

Simplified the home page theme and rebuilt the hero:
- White background with near-black text and #C87D55 reserved for small accents
- Balanced the Rosemary Williams wordmark with larger navigation links
- Replaced the hero with the requested statement, byline, and four evenly spaced artworks
- Connected the hero artwork and labels to Rosemary's admin-managed featured works and titles

Implemented the Cloudflare gallery backend and private art manager:
- R2 image uploads with automatic WebP display and thumbnail generation
- D1 artwork metadata, ordering, visibility, and storage accounting
- Cloudflare Access JWT verification plus an exact administrator allowlist
- Public gallery API and lazy-loaded gallery integration
- 9 GB free-tier safety limit and setup documentation
