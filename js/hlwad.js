/*
 * Copyright (c) 2012 Michael Domanski
 *
 * This software is provided 'as-is', without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */

var wadInfo_t = Struct.create(
	Struct.string("id", 4),
	Struct.int32("ndirnum"),
	Struct.int32("diroffset")
);

var wadDirectory_r = Struct.create(
	Struct.int32("filepos"),
	Struct.int32("disksize"),
	Struct.int32("size"),
	Struct.int8("type"),
	Struct.int8("compression"),
	Struct.int8("pad1"),
	Struct.int8("pad2"),
	Struct.string("name", 16)
);

var totalTexturesCreated = 0;

/**
 * WAD Textures NOTES
 *
 * a-z, 0-9 - regularly tiling textures
 * -0 .. -9 - randomly tiling textures (e.g. -0name)
 * +0 .. +9 - regularly animated textures
 * +A...	- toggled state of the animated texture (e.g. switched off by some trigger)
 * ~...		- light textures accompanied by lights.rad definitions
 * {...		- partially transparent textures
 * !...		- animated water texture (programmatic distortion)
 * !cur		- fast current animation
 * AAATRIGGER	- invisible triggers
 * CLIP			- block player movement
 *
 *
 * Texture types:
 * 0x43 (67)	- regular
 * 0x40			- tempdecal.wad
 * 0x42			- cached.wad
 * 0x46			- fonts
 */

var HLWAD =
{
	Debug: false,
	ShowTextures: false,
	
	load: function(filename, mipTex, callback)
	{
		var wadFile = filename.substr(filename.lastIndexOf("\\")+1);
		if (!wadFile) return callback();

		filename = "data/wad/"+wadFile;


		for (var j=0; j<mipTex.length; j++)
		{
			var m = mipTex[j];

			for (var i=0; i<MIPLEVELS; i++)
			{
				m.offsets[i] = (i == 0 ? 40 : (m.offsets[i-1] + (m.width/Math.pow(2,i-1))*(m.height/Math.pow(2,i-1))));
			}
		}

		HLWAD.Debug && console.log("Loading WAD file: ", filename)
		var self = this;
		var request = new XMLHttpRequest();
		request.addEventListener("load", function()
		{
			if (request.status == 404)
			{
				callback && callback("File '%s' does not exist", filename);
				return;
			}
			var data = request.response;
			HLWAD.Debug && console.log("Downloaded WAD file "+filename, data);

			self.parse(data, mipTex, callback);
		});

		request.open("GET", filename, true);
		request.responseType = "arraybuffer";
		request.send(null);
	},

	parse: function(buffer, mipTex, callback)
	{
		var header = wadInfo_t.readStructs(buffer, 0, 1)[0];
		HLWAD.Debug && console.log("WAD header: ", header);

		var directory = wadDirectory_r.readStructs(buffer, header.diroffset, header.ndirnum);
		HLWAD.Debug && console.log("Directory: ", directory);

		var texMap = {};
		for (var i=0; i<directory.length; i++)
			texMap[directory[i].name.toUpperCase()] = directory[i];

		HLWAD.Debug && console.log(texMap);

		// load only textures used by the map
		var start = new Date().getTime();

		for (var i=0; i<mipTex.length; i++)
		{
			var mip = mipTex[i];
			var dir = texMap[mip.szname.toUpperCase()];
			if (!dir) continue;
			this.readTexture(buffer, mip, dir);
		}

		var end = new Date().getTime();
		HLWAD.Debug && console.log("Loading textures took ", end-start, " ms");

		callback();
	},

	readTexture: function(buffer, mip, header)
	{
		var bytes = new Uint8Array(buffer, header.filepos, header.size);

		var width = mip.width;
		var height = mip.height;
		var palIndex = mip.offsets[3] + ((width/8) * (height/8))+2;
		var rgbPalette = new Uint8Array(buffer, header.filepos + palIndex, 255*3);
		var palTexture = new Uint8Array(buffer, header.filepos + mip.offsets[0], width*height);

		var canvas = document.createElement("canvas");
		var ctx = canvas.getContext("2d");
		canvas.width = mip.width;
		canvas.height = mip.height;
		var idata = ctx.getImageData(0, 0, width, height);
		var data = idata.data;

		var rgb = new Uint8Array(width * height * 3);
		for (var y=0; y<height; y++)
		{
			var yIndex = y * width;
			for (var x=0; x<width; x++)
			{
				var index = yIndex + x;
				var idx = index*3;
				var palIndex = palTexture[index] * 3;
				if (palIndex > 768) console.error(palIndex);

				rgb[idx] = rgbPalette[palIndex];
				rgb[idx+1] = rgbPalette[palIndex+1];
				rgb[idx+2] = rgbPalette[palIndex+2];

				data[index*4+0] = rgb[idx];
				data[index*4+1] = rgb[idx+1];
				data[index*4+2] = rgb[idx+2];
				data[index*4+3] = (mip.szname.indexOf("{") == 0 && palIndex/3 == 255) ? 0 : 255;
			}
		}

		ctx.putImageData(idata, 0,0);

		var log2 = Math.log(2);
		var pow2 = Math.ceil(Math.log(width) / log2);
		var newWidth = Math.pow(2, pow2);
		pow2 = Math.ceil(Math.log(height) / log2);
		var newHeight = Math.pow(2, pow2);

		if (newWidth != width || newHeight != height)
		{
			var cv = document.createElement("canvas");
			var cvctx = cv.getContext("2d");
			cv.width = newWidth;
			cv.height = newHeight;

			cvctx.drawImage(canvas, 0, 0, width, height, 0, 0, newWidth, newHeight);
			var idata = cvctx.getImageData(0, 0, newWidth, newHeight);
			var data = idata.data;

			rgb = new Uint8Array(newWidth * newHeight * 3);
			for (var i=0; i<data.length/4; i++)
			{
				rgb[i*3+0] = data[i*4+0];
				rgb[i*3+1] = data[i*4+1];
				rgb[i*3+2] = data[i*4+2];
			}

			width = newWidth;
			height = newHeight;


			canvas = cv;
		}

		if (HLWAD.ShowTextures) document.body.appendChild(canvas);

		var image = {};
		mip.image = image;
		this.buildTexture(image, mip, width,height, rgb);

		if (mip.szname == "aaatrigger") image.translucent = true;
	},

	buildTexture: function(image, header, w, h, data)
	{
		image.width = w;
		image.height = h;
		image.texture = gl.createTexture();

		gl.bindTexture(gl.TEXTURE_2D, image.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, w,h, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	}
}
