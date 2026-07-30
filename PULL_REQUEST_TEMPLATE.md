# PR: feat(home): redesign landing page — divine/spiritual hero & curated sections

This pull request updates the landing/home page to match a divine and spiritual design aesthetic, using curated imagery and improved layout. Changes are implemented using Tailwind CSS and keep existing routing and data structures.

Summary of changes:

- Redesigned hero section with CTA buttons and search controls
- Trending Pujas grid with image cards and booking CTA
- Upcoming Festivals panel and Popular Pandit Ji list in sidebar
- Asset mapping updated to use curated Unsplash imagery
- Added image assets under public/images/

Files changed:
- src/pages/HomePage.jsx (newly updated landing page)
- src/constants/visualAssets.js (points to curated imagery)
- public/images/* (15 images added)

Preview locally:
1. git fetch origin feature/homepage-redesign
2. git checkout feature/homepage-redesign
3. npm install
4. npm run dev
5. Open the app and visit the root URL (/)

Image attributions (Unsplash):
- puja-ganesh.jpg — https://unsplash.com/photos/1517457373958-b7bdd4587205
- puja-satyanarayan.jpg — https://unsplash.com/photos/1519834785169-98be25ec3f84
- puja-griha-pravesh.jpg — https://unsplash.com/photos/1522708323590-d24dbb6b0267
- puja-navgraha.jpg — https://unsplash.com/photos/1500534623283-312aade485b7
- festival-diwali.jpg — https://unsplash.com/photos/1545239351-1141bd82e8a6
- festival-ganesh.jpg — https://unsplash.com/photos/1575936123452-b67c3203c357
- festival-akshaya.jpg — https://unsplash.com/photos/1508672019048-805c876b67e2
- festival-shivratri.jpg — https://unsplash.com/photos/1506126613408-eca07ce68773
- pandit-1.jpg — https://unsplash.com/photos/1500648767791-00dcc994a43e
- pandit-2.jpg — https://unsplash.com/photos/1494790108377-be9c29b29330
- pandit-3.jpg — https://unsplash.com/photos/1506794778202-cad84cf45f1d
- pandit-4.jpg — https://unsplash.com/photos/1544005313-94ddf0286df2

Notes:
- The branch preserves existing API calls and dynamic data usage; only front-end presentation is changed.
- Please review on both desktop and mobile and let me know if you'd like different imagery or copy changes.

---

