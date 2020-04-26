Half-Life WebGL level and model viewer
======================================

This project loads and displays .bsp and .mdl files from the game Half-Life, using WebGL.

DEMO:
-----
https://hlbsp.netlify.app/

**(Please note, the levels and textures might take a while to load)**

*Update 02.01.2012*
- removed WAD texture loading, using plain JPG images now (loading times improved vastly!)
- alpha mask textures support

NOTES:
- .bsp, .wad and .mdl files are loaded and processed as binary files
- models rendering is very crude - no animation support and thus some of the bones are distorted (omg zombie)
- some brush entities are not positioned correctly, this might require more sophisticated level parsing 


Feel free to extend this project! It would be awesome to see some animated characters, workable entities, effects and what not ;)



Code was initially inspired by Brandon Jones's Quake2 viewer.
It uses gl-utils and js-struct libraries written by him, go, take a look!
https://github.com/toji



