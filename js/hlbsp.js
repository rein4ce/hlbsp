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

var LUMP_ENTITIES			= 0,
	LUMP_PLANES				= 1,
	LUMP_TEXTURES			= 2,
	LUMP_VERTEXES			= 3,
	LUMP_VISIBILITY			= 4,
	LUMP_NODES				= 5,
	LUMP_TEXINFO			= 6,
	LUMP_FACES				= 7,
	LUMP_LIGHTING			= 8,
	LUMP_CLIPNODES			= 9,
	LUMP_LEAFS				= 10,
	LUMP_MARKSURFACES		= 11,
	LUMP_EDGES				= 12,
	LUMP_SURFEDGES			= 13,
	LUMP_MODELS				= 14,
	HEADER_LUMPS			= 15;

var MAXLIGHTMAPS			= 4;
var MIPLEVELS				= 4;
var MAX_MAP_HULLS			= 4;
var VERTEX_SIZE				= 7;
var STRIDE					= VERTEX_SIZE * 4;
var LIGHTMAP_SIZE			= 512;

var AMBIENT_WATER			= 0,
	AMBIENT_SKY				= 1,
	AMBIENT_SLIME			= 2,
	AMBIENT_LAVA			= 3,
	NUM_AMBIENTS			= 4;


var Vector = Struct.create(
	Struct.array("pos", Struct.float32(), 3)
);

var lump_t = Struct.create(
	Struct.int32("offset"),
	Struct.int32("length")
);

var header_t = Struct.create(
	Struct.int32("version"),
	Struct.array("lumps", lump_t, HEADER_LUMPS)
);

var edge_t = Struct.create(
	Struct.uint16("nV1"),			// index in vertex array
	Struct.uint16("nV2")
);

var face_t = Struct.create(
	Struct.uint16("nPlane"),		// index in plane array
	Struct.int16("cSide"),			// 0 if face normal is same as plane normal
	Struct.int32("nE1"),			// index of first edge in face_edge array
	Struct.int16("cEdges"),
	Struct.int16("nTextureInfo"),
	Struct.array("lightMapStyles", Struct.uint8(), MAXLIGHTMAPS),
	Struct.int32("nLightMapOfs")
);

var plane_t = Struct.create(
	Struct.array("fNormal", Struct.float32(), 3),
	Struct.float32("fDistance"),
	Struct.uint32("type")
);

var node_t = Struct.create(
	Struct.uint32("nPlane"),
	Struct.int16("nFront"),
	Struct.int16("nBack"),
	Struct.array("minBox", Struct.int16(), 3),
	Struct.array("maxBox", Struct.int16(), 3),
	Struct.uint16("nFirstFace"),
	Struct.uint16("cFaces")
);

var leaf_t = Struct.create(
	Struct.int32("contents"),
	Struct.int32("ofsCluster"),
	Struct.array("minBox", Struct.int16(), 3),
	Struct.array("maxBox", Struct.int16(), 3),
	Struct.uint16("nFirstFace"),
	Struct.uint16("cFaces"),
	Struct.array("ambient_level", Struct.uint8(), NUM_AMBIENTS)
);

var texInfo_t = Struct.create(
	Struct.array("uAxis", Struct.float32(), 3),
	Struct.float32("uOffset"),
	Struct.array("vAxis", Struct.float32(), 3),
	Struct.float32("vOffset"),
	Struct.int32("nMipTex"),
	Struct.int32("flags")
);

var texLump_t = Struct.create(
	Struct.int32("nummiptex")
);

var mipTex_t = Struct.create(
	Struct.string("szname", 16),
	Struct.uint32("width"),
	Struct.uint32("height"),
	Struct.array("offsets", Struct.uint32(), MIPLEVELS)
);

var model_t = Struct.create(
	Struct.array("mins", Struct.float32(), 3),
	Struct.array("maxs", Struct.float32(), 3),
	Struct.array("origin", Struct.float32(), 3),
	Struct.array("headnode", Struct.int32(), MAX_MAP_HULLS),
	Struct.int32("visleafs"),
	Struct.int32("firstface"),
	Struct.int32("numfaces")
);

var Entity =
{
	model: null,
	position: [0,0,0],
	worldMatrix: []
};

/**
 * Create a BSP level object
 * @param filename
 * @param [callback]
 */
var HLBSP = function(filename, callback)
{
	this.bsp = {};
	this.nullLightmap = null;
	this.models = {};
	this.entities = [];
	this.map = null;

	if (filename) this.load(filename);
}

HLBSP.Debug = false;
HLBSP.Textures = {};			// textures map that lasts through the sessions
HLBSP.ShowTextures = false;

HLBSP.prototype =
{
	load: function(filename)
	{
		HLBSP.Debug && console.log("Loading map "+filename);

		var map =
		{
			vertBuffer: gl.createBuffer(),
			textures: [],
			lightmap: null,
			faces: []
		};
		var self = this;

		// create default lightmap
		this.nullLightmap = createSolidTexture(gl, [255,255,255,255]);

		// download and parse level
		var request = new XMLHttpRequest();
		request.addEventListener("load", function()
		{
			if (request.status == 404)
			{
				console.error("Error while loading map '%s': 404", filename);
				return;
			}
			self.parse(map, request.response);
		});

		request.open("GET", filename, true);
		request.responseType = "arraybuffer";
		request.send(null);

		this.map = map;
	},

	parse: function(map, buffer, onload)
	{
		// load header
		var header = header_t.readStructs(buffer, 0, 1)[0];
		HLBSP.Debug && console.log("Header: ", header);

		// load other lumps
		var bsp =
		{
			vertices:	this.parseLump(buffer, header.lumps[LUMP_VERTEXES], Vector),
			edges:		this.parseLump(buffer, header.lumps[LUMP_EDGES], edge_t),
			faces:		this.parseLump(buffer, header.lumps[LUMP_FACES], face_t),
			texInfo:	this.parseLump(buffer, header.lumps[LUMP_TEXINFO], texInfo_t),
			nodes:		this.parseLump(buffer, header.lumps[LUMP_NODES], node_t),
			planes:		this.parseLump(buffer, header.lumps[LUMP_PLANES], plane_t),
			leafs:		this.parseLump(buffer, header.lumps[LUMP_LEAFS], leaf_t),
			models:		this.parseLump(buffer, header.lumps[LUMP_MODELS], model_t)
		};
		this.bsp = bsp;

		var surfEdgeLump = header.lumps[LUMP_SURFEDGES];
		var lightingLump = header.lumps[LUMP_LIGHTING];
		var leafFaceLump = header.lumps[LUMP_MARKSURFACES];
		var entitiesLump = header.lumps[LUMP_ENTITIES];
		var texturesLump = header.lumps[LUMP_TEXTURES];

		bsp.surfEdges = new Int32Array(buffer, surfEdgeLump.offset, surfEdgeLump.length/4);
		bsp.lighting = new Uint8Array(buffer, lightingLump.offset, lightingLump.length);
		bsp.leafFaces = new Int16Array(buffer, leafFaceLump.offset, leafFaceLump.length/2);
		var entBuf = new Uint8Array(buffer, entitiesLump.offset, entitiesLump.length);
		bsp.entities = "";
		for (var i=0; i<entitiesLump.length; i++)
			bsp.entities += String.fromCharCode(entBuf[i]);

		var view = new DataView(buffer, 0);
		bsp.texData = texLump_t.readStructs(buffer, texturesLump.offset, 1)[0];
		bsp.texOffsets = new Uint32Array(buffer, texturesLump.offset+4, bsp.texData.nummiptex);
		bsp.mipTex = [];
		for (var i=0; i<bsp.texData.nummiptex; i++)
		{
			var offset = texturesLump.offset + bsp.texOffsets[i];
			var mipTex = mipTex_t.readStructs(buffer, offset, 1)[0];
			bsp.mipTex.push(mipTex);
		}

		var self = this;
		HLBSP.Debug && console.log(bsp);
		HLBSP.Debug && console.log("Textures to be loaded: ",bsp.mipTex.length);

		map.lightmapOffset = header.lumps[LUMP_LIGHTING].offset;

		bsp.entities = this.parseEntities(bsp.entities);
		this.spawnEntities(bsp.entities);

		// Position the camera at player start entity
		var playerStart = this.findEntity("info_player_start");
		if (playerStart)
		{
			var org = playerStart.origin.split(/\s+/g);
			game.cameraPosition[0] = -parseFloat(org[0]);
			game.cameraPosition[1] = -parseFloat(org[1]);
			game.cameraPosition[2] = -parseFloat(org[2]) - 32;
			game.zAngle = ((-parseFloat(playerStart["angle"]) + 90 ) * Math.PI/180) || 0;
			HLBSP.Debug && console.log("Player start: ", org);
		}

		this.loadTextures(bsp.texInfo, function(tex)
		{
			map.textures = bsp.mipTex;
			self.compile(bsp, map, buffer);
			onload && onload(map);
		});
	},

	parseLump: function(buffer, lump, struct)
	{
		//HLBSP.Debug && console.log(lump.offset, lump.length, struct.byteLength)
		return struct.readStructs(buffer, lump.offset, lump.length/struct.byteLength);
	},

	loadTextures: function(texInfos, callback)
	{
		var world = this.findEntity("worldspawn");
		if (!world) throw "Error: Unable to find WAD file in entity list";

		var toLoad = [];

		for (var i=0; i<this.bsp.mipTex.length; i++)
		{
			var tex = this.bsp.mipTex[i];
			if (HLBSP.Textures[tex.szname])
			{
				createTexture(HLBSP.Textures[tex.szname].image, tex.szname);
				continue;
			}
			toLoad.push(tex.szname);
		}

		var self = this;
		var loaded = 0;

		function createTexture(image, name)
		{
			var log2 = Math.log(2);
			var pow2 = Math.ceil(Math.log(image.width) / log2);
			var newWidth = Math.pow(2, pow2);
			pow2 = Math.ceil(Math.log(image.height) / log2);
			var newHeight = Math.pow(2, pow2);

			var cv = document.createElement("canvas");
			var cvctx = cv.getContext("2d");
			cv.width = newWidth;
			cv.height = newHeight;

			cvctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, newWidth, newHeight);
			var idata = cvctx.getImageData(0, 0, newWidth, newHeight);
			var data = new Uint8Array(idata.data);

			for (var i=0; i<data.length; i+=4)
			{
				if (data[i] < 30 && data[i+1] < 30 && data[i+2] > 125)		// TODO: detect blue mask in JPEGs
				{
					data[i+3] = 0;
				}
			}

			var texture =
			{
				image: image,
				width: newWidth,
				height: newHeight,
				texture: gl.createTexture(),
				translucent: name == "aaatrigger"
			};

			gl.bindTexture(gl.TEXTURE_2D, texture.texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, newWidth,newHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

			HLBSP.Textures[name] = texture;

			if (HLBSP.ShowTextures) document.body.appendChild(cv);
		}

		function finish()
		{
			HLBSP.Debug && console.log("Finished loading all images");

			for (var i=0; i<self.bsp.mipTex.length; i++)
				self.bsp.mipTex[i].image = HLBSP.Textures[self.bsp.mipTex[i].szname];

			$("#loading").hide();
		}

		if (toLoad.length == 0)
		{
			finish();
		}
		else
		{
			$.each(toLoad, function(i, name)
			{
				var path = "data/textures/_"+toLoad[i]+".jpg";
				var img = new Image();
				img.addEventListener("load", function()
				{
					createTexture(img, name);

					if (++loaded == toLoad.length)
					{
						finish();
					}
				});
				img.addEventListener("error", function(err)
				{
					console.error(err);
					img.src = "data/textures/_BLACK.jpg";
					return true;
				});

				img.src = path;
			});
		}

		callback();			// Proceed right away, load textures asynchronously
	},

	parseEntities: function(buffer)
	{
		var entities = [];
		var entries = buffer.match(/{[^}]+}/g);

		for (var i=0; i<entries.length; i++)
		{
			var entry = entries[i];
			var match = entry.match(/\"([^\"]+)\"/g);
			var entity = {};
			for (var j=0; j<match.length/2; j++)
				entity[match[j*2].replace(/\"/g,"")] = match[j*2+1].replace(/\"/g,"");
			HLBSP.Debug && console.log(entity)
			entities.push(entity);
		}
		return entities;
	},

	spawnEntities: function(entities, callback)
	{
		HLBSP.Debug && console.log("Spawning entities");

		var modelsToLoad = {};

		// Get names of all used entities
		for (var i=0; i<entities.length; i++)
		{
			var e = entities[i];
			var name = e["classname"];

			var type = Entities[name];
			if (!type || !type.model) continue;

			modelsToLoad[type.model] = true;
		}

		// Load all entities
		var paths = Object.keys(modelsToLoad);
		var counter = paths.length;
		var self = this;
		for (var i=0; i<paths.length; i++)
		{
			self.models[paths[i]] = new HLMDL("models/"+paths[i], function()
			{
				if (--counter == 0)
				{
					HLBSP.Debug && console.log("Loaded all models", self.models);

					for (var i=0; i<entities.length; i++)
					{
						var e = entities[i];
						var name = e["classname"];

						var type = Entities[name];
						if (!type || !type.model) continue;

						var pos = e["origin"].split(/\s+/);

						var ent =
						{
							model: self.models[type.model],
							position: [
								parseFloat(pos[0]),
								parseFloat(pos[1]),
								parseFloat(pos[2])
							],
							angle: parseFloat(e["angle"]) || 0
						};

						HLBSP.Debug && console.log("Creating entity: ", ent);
						self.entities.push(ent);
					}

					callback && callback();
				}
			});
		}
	},

	findEntity: function(classname)
	{
		for (var i=0; i<this.bsp.entities.length; i++)
			if (this.bsp.entities[i].classname == classname)
				return this.bsp.entities[i];
	},

	initLightmap: function()
	{
		var texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, LIGHTMAP_SIZE, LIGHTMAP_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

		var whitePixel = new Uint8Array([255, 255, 255, 255]);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, LIGHTMAP_SIZE - 1, LIGHTMAP_SIZE - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, whitePixel);

		return {
			texture: texture,
			root:
			{
				x: 0, y: 0,
				width: LIGHTMAP_SIZE, height: LIGHTMAP_SIZE
			}
		}
	},

	getLightmapDimensions: function(faceVerts)
	{
		var min_u = Math.floor(faceVerts[0].uv[0]);
		var min_v = Math.floor(faceVerts[0].uv[1]);
		var max_u = Math.floor(faceVerts[0].uv[0]);
		var max_v = Math.floor(faceVerts[0].uv[1]);

		for (var i = 1; i < faceVerts.length; ++i)
		{
			var faceVert = faceVerts[i];

			if (Math.floor(faceVert.uv[0]) < min_u)
				min_u = Math.floor(faceVert.uv[0]);

			if (Math.floor(faceVert.uv[1]) < min_v)
				min_v = Math.floor(faceVert.uv[1]);

			if (Math.floor(faceVert.uv[0]) > max_u)
				max_u = Math.floor(faceVert.uv[0]);

			if (Math.floor(faceVert.uv[1]) > max_v)
				max_v = Math.floor(faceVert.uv[1]);
		}

		return {
			width: Math.ceil(max_u / 16) - Math.floor(min_u / 16) + 1,
			height: Math.ceil(max_v / 16) - Math.floor(min_v / 16) + 1,
			min_u: Math.floor(min_u),
			min_v: Math.floor(min_v)
		};
	},

	allocateLightmapRect: function(node, width, height)
	{
		if (node.nodes)
		{
			var ret = this.allocateLightmapRect(node.nodes[0], width, height);
			if (ret) return ret;
			return this.allocateLightmapRect(node.nodes[1], width, height);
		}

		if (node.filled) return null;

		if (node.width < width || node.height < height) return null;

		if (node.width == width && node.height == height)
		{
			node.filled = true;
			return node;
		}

		var nodes;
		if ((node.width - width) > (node.height - height))
		{
			nodes = [{
				x: node.x,
				y: node.y,
				width: width,
				height: node.height
			}, {
				x: node.x + width,
				y: node.y,
				width: node.width - width,
				height: node.height
			}];
		} else {
			nodes = [{
				x: node.x,
				y: node.y,
				width: node.width,
				height: height
			}, {
				x: node.x,
				y: node.y + height,
				width: node.width,
				height: node.height - height
			}];
		}
		node.nodes = nodes;
		return this.allocateLightmapRect(node.nodes[0], width, height);
	},

	readLightmap: function(lightmap, offset, width, height, buffer)
	{
		if (height <= 0 || width <= 0) return null;

		var node = this.allocateLightmapRect(lightmap.root, width, height);

		if (node)
		{
			var byteCount = width * height * 4;
			var bytes = new Uint8Array(byteCount);
			var curByte = 0;
			var rgb = new Uint8Array(buffer, offset, width * height * 3);

			for (var i=0; i<width * height; i++)
			{
				bytes[curByte++] = rgb[i*3+0];
				bytes[curByte++] = rgb[i*3+1];
				bytes[curByte++] = rgb[i*3+2];
				bytes[curByte++] = 255;
			}

			gl.bindTexture(gl.TEXTURE_2D, lightmap.texture);
			gl.texSubImage2D(gl.TEXTURE_2D, 0, node.x, node.y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
		}
		return node;
	},

	processLightmap: function(lightmap, faceVerts, texInfo, offset, buffer)
	{
		var size = this.getLightmapDimensions(faceVerts);
		var rect = this.readLightmap(lightmap, offset, size.width, size.height, buffer);

		if (rect)
		{
			for (var i=0; i<faceVerts.length; i++)
			{
				var faceVert = faceVerts[i];
				var s = (vec3.dot(faceVert.pos, texInfo.uAxis) + texInfo.uOffset) - size.min_u;
				s += (rect.x * 16) + 8;
				s /= LIGHTMAP_SIZE * 16;

				var t = (vec3.dot(faceVert.pos, texInfo.vAxis) + texInfo.vOffset) - size.min_v;
				t += (rect.y * 16) + 8;
				t /= LIGHTMAP_SIZE * 16;

				faceVert.luv = [s, t];
			}
		}
	},

	compile: function(bsp, map, buffer)
	{
		HLBSP.Debug && console.log("Compiling map");
		var vertsByTexture = new Array(map.textures.length);
		var edgeIndex, v, vert0, vert1, vert2;

		var lightmap = this.initLightmap();

		for (var i=0; i<bsp.faces.length; i++)
		{
			var face = bsp.faces[i];
			var texInfo = bsp.texInfo[face.nTextureInfo];

			if (!texInfo)
			{
				console.error("Face ",face," has invalid texInfo");
				continue;
			}

			// TODO: check if sky

			var faceVerts = [];
			var texVerts = vertsByTexture[texInfo.nMipTex];
			if (!texVerts)
				texVerts = vertsByTexture[texInfo.nMipTex] = [];

			var verts = [];
			var edges = [];
			for (var e=0; e<face.cEdges; e++)
				edges.push(bsp.surfEdges[face.nE1+e]);

			// vertex 0
			edgeIndex = edges[0];
			v = edgeIndex > 0 ? "nV1" : "nV2";
			verts.push(vert0 = bsp.vertices[bsp.edges[Math.abs(edgeIndex)][v]].pos);

			var uv0 = [
				vec3.dot(vert0, texInfo.uAxis) + texInfo.uOffset, vec3.dot(vert0, texInfo.vAxis) + texInfo.vOffset];


			// vertex 1
			edgeIndex = edges[1];
			v = edgeIndex > 0 ? "nV1" : "nV2";
			verts.push(vert1 = bsp.vertices[bsp.edges[Math.abs(edgeIndex)][v]].pos);

			var uv1 = [
				vec3.dot(vert1, texInfo.uAxis) + texInfo.uOffset, vec3.dot(vert1, texInfo.vAxis) + texInfo.vOffset];


			// rest of the vertices, start creating triangles
			for (var j=2; j<edges.length; j++)
			{
				edgeIndex = edges[j];
				v = edgeIndex > 0 ? "nV1" : "nV2";
				verts.push(vert2 = bsp.vertices[bsp.edges[Math.abs(edgeIndex)][v]].pos);

				var uv2 = [
					vec3.dot(vert2, texInfo.uAxis) + texInfo.uOffset, vec3.dot(vert2, texInfo.vAxis) + texInfo.vOffset];

				faceVerts.push({
					pos: vert0,
					uv: uv0,
					luv: [0.999,0.999]
				});
				faceVerts.push({
					pos: vert1,
					uv: uv1,
					luv: [0.999,0.999]
				});
				faceVerts.push({
					pos: vert2,
					uv: uv2,
					luv: [0.999,0.999]
				});

				//HLBSP.Debug && console.log(uv2)

				vert1 = vert2;
				uv1 = uv2;
			}

			if (texInfo.flags == 0)
				this.processLightmap(lightmap, faceVerts, texInfo, map.lightmapOffset + face.nLightMapOfs, buffer);

			for (var j=0; j<faceVerts.length; j++)
				texVerts.push(faceVerts[j]);

			map.faces.push({ imageIdx: texInfo.nMipTex });
		}

		gl.bindTexture(gl.TEXTURE_2D, lightmap.texture);
		gl.generateMipmap(gl.TEXTURE_2D);

		map.lightmap = lightmap.texture;
		map.vertCount = verts.length / VERTEX_SIZE;

		var glArray = this.fillBuffer(map.textures, vertsByTexture);

		// fill vertex buffer
		gl.bindBuffer(gl.ARRAY_BUFFER, map.vertBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, glArray, gl.STATIC_DRAW);
	},

	fillBuffer: function(textures, texVerts)
	{
		var offset = 0;
		var totalCount = 0;
		for (var i=0; i<texVerts.length; i++)
			if (texVerts[i]) totalCount += texVerts[i].length * VERTEX_SIZE;

		var glArray = new Float32Array(totalCount);

		for (var i=0; i<texVerts.length; i++)
		{
			if (!texVerts[i]) continue;

			var verts = texVerts[i];
			var texture = textures[i];

			texture.vertOffset = offset / VERTEX_SIZE;
			texture.vertCount = verts.length;

			//HLBSP.Debug && console.log(verts.length, texture.vertOffset, texture.vertCount, texture.width, texture.height)

			for (var j=0; j<verts.length; j++)
			{
				var vert = verts[j];

				// position
				glArray[offset++] = vert.pos[0];
				glArray[offset++] = vert.pos[1];
				glArray[offset++] = vert.pos[2];

				// uv
				glArray[offset++] = vert.uv[0] / texture.width;
				glArray[offset++] = vert.uv[1] / texture.height;

				// lightmap uv
				glArray[offset++] = vert.luv[0];
				glArray[offset++] = vert.luv[1];
			}
		}

		return glArray;
	},

	drawEntities: function(shader)
	{
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.nullLightmap);
		gl.uniform1i(shader.uniform.lightmap, 0);

		for (var i=0; i<this.entities.length; i++)
		{
			var e = this.entities[i];

			var modelViewMat = mat4.create();
			mat4.identity(modelViewMat);
			mat4.rotateX(modelViewMat, game.xAngle-Math.PI/2);
			mat4.rotateZ(modelViewMat, game.zAngle);
			mat4.translate(modelViewMat, game.cameraPosition);
			mat4.translate(modelViewMat, e.position);
			mat4.rotateZ(modelViewMat, e.angle*Math.PI/2);

			gl.uniformMatrix4fv(shader.uniform.modelViewMat, false, modelViewMat);

			e.model.draw(shader);
		}
	},

	draw: function(shader)
	{
		var map = this.map;

		// Enable vertex arrays
		gl.enableVertexAttribArray(shader.attribute.position);
		gl.enableVertexAttribArray(shader.attribute.texCoord);
		gl.enableVertexAttribArray(shader.attribute.texCoord2);

		gl.enable(gl.CULL_FACE);

		if (map.vertBuffer != null)
		{
			// Bind the vertex buffer
			gl.bindBuffer(gl.ARRAY_BUFFER, map.vertBuffer);
			gl.vertexAttribPointer(shader.attribute.position, 3, gl.FLOAT, false, STRIDE, 0);
			gl.vertexAttribPointer(shader.attribute.texCoord, 2, gl.FLOAT, false, STRIDE, 3 * 4);
			gl.vertexAttribPointer(shader.attribute.texCoord2, 2, gl.FLOAT, false, STRIDE, 5 * 4);

			if (shader.uniform.diffuse)
				gl.uniform1i(shader.uniform.diffuse, 0);

			if (shader.uniform.lightmap)
			{
				// Bind the lightmap texture (shared by all faces)
				gl.activeTexture(gl.TEXTURE1);
				gl.bindTexture(gl.TEXTURE_2D, map.lightmap);
				gl.uniform1i(shader.uniform.lightmap, 1);
			}

			gl.uniform1f(shader.uniform.alpha, 1.0);

			// Since faces are sorted by texture, we loop through all textures in the map
			for (var i = 0; i < map.textures.length; ++i)
			{
				var texture = map.textures[i];
				if (!texture.vertCount || !texture.image) continue;

				//HLBSP.Debug && console.log(shader.uniform.alpha)
				if (texture.image.translucent) continue;

				// Bind the texture
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture.image.texture);

				// Draw all faces for this texture (brute force, no visibility checks)
				gl.drawArrays(gl.TRIANGLES, texture.vertOffset, texture.vertCount);
			}

			// Draw translucent entities
			/*gl.uniform1f(shader.uniform.alpha, 0.1);

			// draw translucent
			for (var i = 0; i < map.textures.length; ++i)
			{
				var texture = map.textures[i];
				if (!texture.vertCount) continue;

				//HLBSP.Debug && console.log(shader.uniform.alpha)
				if (!texture.image.translucent) continue;

				// Bind the texture
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, texture.image.texture);

				// Draw all faces for this texture (brute force, no visibility checks)
				gl.drawArrays(gl.TRIANGLES, texture.vertOffset, texture.vertCount);
			}

			gl.uniform1f(shader.uniform.alpha, 1.0);*/
		}
	}
};
