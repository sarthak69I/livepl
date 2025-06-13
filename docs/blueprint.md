# **App Name**: StreamCast

## Core Features:

- Player Interface: Display a modern, dark-themed video player interface including play/pause, volume, current time/duration, settings (if applicable for the stream), and fullscreen controls.
- URL Parameter Loading: Implement URL parameter (?liveurl=...) to directly load and play .m3u8 streams from castr.com when the page loads.
- Embedded Mode: Ensure the player interface is minimalistic, showing only the video and controls to facilitate embedding without extra visual elements, stripping all unessential UI.
- Stream Delivery by Castr: Make use of Castr.com to handle live streaming delivery. StreamCast does not provide streaming itself.

## Style Guidelines:

- Primary color: Dark purple (#7952B3) to provide a sophisticated and modern aesthetic suitable for streaming.
- Background color: Very dark gray (#212121) to reduce distractions and highlight the video content.
- Accent color: Bright purple (#BB86FC) for interactive elements such as the play/pause button and volume control to ensure they are easily visible against the dark background.
- Font: 'Inter', sans-serif, for a modern, clean look in the video player controls.
- Use simple, outlined icons in a light color for controls (play, pause, volume, settings, fullscreen) to ensure clarity and visibility.
- Minimalist layout focusing on the video; controls should overlay the video and fade out when not in use.
- Subtle fade-in and fade-out animations for controls to avoid distractions and maintain a clean interface.