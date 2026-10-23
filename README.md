# GlassHome

A Spicetify theme: frosted-glass panels over a blurred,
cover-tinted backdrop, a floating pill player, and a "now playing" hero on the Home page.

## What it does

- Backdrop follows the cover of the current track (blurred, cross-fades between tracks).
- Library, Now Playing panel and player are translucent glass; menus, dialogs and the search dropdown stay opaque
  and take the cover's colour.
- Floating player that overlays the content instead of reserving a bar.
- Home hero with the current title/artist, Play/Pause and Lyrics.
- Optional **lite mode** (profile menu → "GlassHome: modo lite"): no blur, no cover layer, no animations.

## Install

From the Marketplace: install the theme. It also installs `theme.js` (listed under `include` in `manifest.json`);
the theme looks broken without it.

Manually:

```bash
# copy theme/user.css and theme/color.ini to  %APPDATA%\spicetify\Themes\GlassHome\
# copy theme/theme.js to the same folder, then:
spicetify config current_theme GlassHome color_scheme Base inject_theme_js 1
spicetify apply
```

## Tested with

Spotify 1.3.6 on Windows 11, Spicetify 2.44. Spotify's layout class names are obfuscated and change between
releases, so the theme finds the layout through CSS grid areas and `data-testid` attributes. A Spotify update can
still break parts of it.

## Notes

- The Home hero, the top-bar handling and the surface clean-up are done in `theme.js`.
- Expect more GPU use than stock Spotify (blur and backdrop filters). Use lite mode if it feels heavy.
