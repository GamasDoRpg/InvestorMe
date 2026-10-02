# Interface background assets

[Documentation index](../../README.md) · [User guide](../../docs/USER_GUIDE.md)

These are decorative local textures, not financial charts or data sources.

- `topography-dark.jpeg`: the first image supplied by the project owner, used without modifying the source image.
- `topography-light.webp`: white variation created with the built-in image-generation tool using the first image as the edit reference; converted to WebP for packaging.

Both assets are bundled locally and work offline. `ui/theme.css` selects the texture for the active theme and adds a subtle overlay for text contrast. The second user reference inspired only the monochrome surfaces, discreet borders, restrained lime accents and typography. Its data, copy, navigation and behavior were not adopted.

Light texture prompt: “Create a light-mode variant of this exact dark abstract topographic marble texture for a desktop application background. Preserve the wide 16:9 composition, organic contour lines, alluvial swirling detail and pattern placement as faithfully as possible. Change only the palette: predominantly clean white and soft ivory-white, delicate pale gray contour lines, extremely subtle silver-gray veins, low contrast suitable behind white translucent UI panels. Flat texture only, edge to edge, no lighting vignette, no text, no symbols, no interface.”

The current themes are dark, light and system. The system option follows the OS color preference; asset selection and overlays are controlled by `ui/theme.css`. Theme/density choices and panel layouts are saved in the local workspace. Historical interface screenshots are retained in the repository for visual reference and do not describe current financial data.

Company marks are documented separately in [companies/README.md](companies/README.md); they are used for asset identity throughout the UI and do not alter financial data.
