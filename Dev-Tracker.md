# Dev Tracker
This file is used by the developer of RosemaryWilliams.art (Agents may use this file in accordance to instructions from the developer.)


# Awaiting

Complete the Cloudflare account setup in BACKEND_SETUP.md (R2, D1, Access,
production variables, and deployment).

we need to completely simplify the website theme (only work on the home page for this pass):
1. background color: white
2. primary color: #C87D55 (Use dark dark gray / near black mostly, use the warm terrocotta primary color as a small splash of color for only the very most important things.)
3. header -> make the "Rosemary Williams" text closer in size to the nav links. (make the links a little bigger too.)
4. simplify the hero section: remove everything, start from scratch, here's what i want it to be: white background color. heading: "Every face holds a history and every landscape whispers a secret". text directly below "Art by Rosemary Williams". at the bottom of the hero (only the top half of the images stick up into the hero) should be 4 images equally separated in width. the images should have labels that can be assigned by rosemary williams.



# Done

Implemented the Cloudflare gallery backend and private art manager:
- R2 image uploads with automatic WebP display and thumbnail generation
- D1 artwork metadata, ordering, visibility, and storage accounting
- Cloudflare Access JWT verification plus an exact administrator allowlist
- Public gallery API and lazy-loaded gallery integration
- 9 GB free-tier safety limit and setup documentation
