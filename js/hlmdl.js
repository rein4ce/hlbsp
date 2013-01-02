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

var mdlHeader_t = Struct.create(
	Struct.uint32("id"),
	Struct.uint32("version"),
	Struct.string("name", 64),
	Struct.uint32("length"),

	Struct.array("eyeposition", Struct.float32(), 3),
	Struct.array("min", Struct.float32(), 3),
	Struct.array("max", Struct.float32(), 3),

	Struct.array("bbmin", Struct.float32(), 3),
	Struct.array("bbmax", Struct.float32(), 3),

	Struct.uint32("flags"),
	Struct.uint32("numbones"),
	Struct.uint32("boneindex"),

	Struct.uint32("numbonecontrollers"),
	Struct.uint32("bonecontrollerindex"),
	Struct.uint32("numhitboxes"),
	Struct.uint32("hitboxindex"),
	Struct.uint32("numseq"),
	Struct.uint32("seqindex"),
	Struct.uint32("numseqgroups"),
	Struct.uint32("seqgroupindex"),
	Struct.uint32("numtextures"),
	Struct.uint32("textureindex"),
	Struct.uint32("texturedataindex"),

	Struct.uint32("numskinref"),
	Struct.uint32("numskinfamilies"),
	Struct.uint32("skinindex"),

	Struct.uint32("numbodyparts"),
	Struct.uint32("bodypartindex"),
	Struct.uint32("numattachments"),
	Struct.uint32("attachmentindex"),

	Struct.uint32("soundtable"),
	Struct.uint32("soundindex"),
	Struct.uint32("soundgroups"),
	Struct.uint32("soundgroupindex"),

	Struct.uint32("numtransitions"),
	Struct.uint32("transitionindex")
);

var mdlTexture_t = Struct.create(
	Struct.string("name", 64),
	Struct.uint32("flags"),
	Struct.uint32("width"),
	Struct.uint32("height"),
	Struct.uint32("index")
);

var mdlModel_t = Struct.create(
	Struct.string("name", 64),
	Struct.uint32("type"),
	Struct.float32("boundingradius"),
	Struct.uint32("nummesh"),
	Struct.uint32("meshindex"),
	Struct.uint32("numverts"),
	Struct.uint32("vertinfoindex"),
	Struct.uint32("vertindex"),
	Struct.uint32("numnorms"),
	Struct.uint32("norminfoindex"),
	Struct.uint32("normindex"),
	Struct.uint32("numgroups"),
	Struct.uint32("groupindex")
);

var mdlBodyParts_t = Struct.create(
	Struct.string("name", 64),
	Struct.uint32("nummodels"),
	Struct.uint32("base"),
	Struct.uint32("modelindex")
);

var mdlMesh_t = Struct.create(
	Struct.uint32("numtris"),
	Struct.uint32("triindex"),
	Struct.uint32("skinref"),
	Struct.uint32("numnorms"),
	Struct.uint32("normindex")
);

var mdlAnim_t = Struct.create(
	Struct.array("offset", Struct.uint16(), 6)
);

var mdlBone_t = Struct.create(
	Struct.string("name", 32),
	Struct.int32("parent"),
	Struct.int32("flags"),
	Struct.array("bonecontroller", Struct.int32(), 6),
	Struct.array("value", Struct.float32(), 6),
	Struct.array("scale", Struct.float32(), 6)
);

var mdlBoneController_t = Struct.create(
	Struct.int32("bone"),
	Struct.int32("type"),
	Struct.float32("start"),
	Struct.float32("end"),
	Struct.int32("rest"),
	Struct.int32("index")
);

var mdlSeqDesc_t = Struct.create(
	Struct.string("label", 32),
	Struct.float32("fps"),
	Struct.int32("flags"),
	Struct.int32("activity"),
	Struct.int32("actweight"),
	Struct.int32("numevents"),
	Struct.int32("eventindex"),
	Struct.int32("numframes"),
	Struct.int32("numpivots"),
	Struct.int32("pivotindex"),
	Struct.int32("motiontype"),
	Struct.int32("motionbone"),
	Struct.array("linearmovement", Struct.float32(), 3),
	Struct.int32("automoveposindex"),
	Struct.int32("automoveangleindex"),
	Struct.array("bbmin", Struct.float32(), 3),
	Struct.array("bbmax", Struct.float32(), 3),
	Struct.int32("numblends"),
	Struct.int32("animindex"),
	Struct.array("blendtype", Struct.int32(), 2),
	Struct.array("blendstart", Struct.float32(), 2),
	Struct.array("blendend", Struct.float32(), 2),
	Struct.int32("blendparent"),
	Struct.int32("seqgroup"),
	Struct.int32("entrynode"),
	Struct.int32("exitnode"),
	Struct.int32("nodeflags"),
	Struct.int32("nextseq")
);

var mdlSeqGroup_t = Struct.create(
	Struct.string("label", 32),
	Struct.string("name", 64),
	Struct.uint32("cache"),
	Struct.uint32("data")
);

var mdlAnimValue_t = Struct.create(
	Struct.uint8("valid"),
	Struct.uint8("total"),
	Struct.int16("value")
);


var STUDIO_X		 	= 1,
 	STUDIO_Y			= 2,
 	STUDIO_Z			= 4;




var HLMDL = function(filename, callback)
{
	this.filename = filename;
	this.header = null;
	this.textures = [];
	this.bodyParts = [];
	this.models = [];
	this.load(filename, callback);
}

HLMDL.VertSize = 5;
HLMDL.Stride = HLMDL.VertSize * 4;
HLMDL.ShowTextures = false;
HLMDL.Debug = false;

HLMDL.prototype =
{	
	load: function(filename, callback)
	{
		var path = "data/valve/"+filename;
	
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
			HLMDL.Debug && console.log("Downloaded model file: ", filename);
			self.parse(data);
			callback && callback();
		});
	
		request.open("GET", path, true);
		request.responseType = "arraybuffer";
		request.send(null);
	},

	parse: function(buffer)
	{
		this.header = mdlHeader_t.readStructs(buffer, 0, 1)[0];
		HLMDL.Debug && console.log("MDL Header: ", this.header);

		var textures = mdlTexture_t.readStructs(buffer, this.header.textureindex, this.header.numtextures);
		HLMDL.Debug && console.log("Model textures: ", textures);

		var self = this;

		if (this.header.numtextures == 0)
		{
			HLMDL.Debug && console.log("No model textures found, loading texture model");
			this.textureModel = new HLMDL(this.filename.replace(".mdl", "t.mdl"), function()
			{
				self.textures = self.textureModel.textures;
				self.header.numskinref = self.textureModel.header.numskinref;
				self.header.numtextures = self.textureModel.header.numtextures;

				self.skinref = self.textureModel.skinref;
				HLMDL.Debug && console.log("Skin ref: ",self.skinref)

				self.setupBones(buffer);
				self.readBodyParts(buffer, self.header);

			});
		}
		else
		{
			for (var i=0; i<textures.length; i++)
				this.readTexture(buffer, textures[i]);

			this.skinref = new Int16Array(buffer, this.header.skinindex, this.header.numskinref);
			HLMDL.Debug && console.log("Skin ref: ",this.skinref)

			this.setupBones(buffer);
			this.readBodyParts(buffer, this.header);
		}
	},

	readTexture: function(buffer, tex)
	{
		var canvas = document.createElement("canvas");
		var ctx = canvas.getContext("2d");
		canvas.width = tex.width;
		canvas.height = tex.height;
		var idata = ctx.getImageData(0, 0, tex.width, tex.height);
		var data = idata.data;

		var textureData = new Uint8Array(buffer, tex.index, tex.width * tex.height);
		var palette = new Uint8Array(buffer, tex.index + tex.width * tex.height, 256 * 3);
		var rgb = new Uint8Array(tex.width * tex.height * 3);

		for (var y=0; y<tex.height; y++)
		{
			var yIndex = y * tex.width;
			for (var x=0; x<tex.width; x++)
			{
				var index = yIndex + x;
				var idx = index*3;
				var pal = textureData[index] * 3;
				if (pal > 768) console.error(pal);

				rgb[idx] = palette[pal];
				rgb[idx+1] = palette[pal+1];
				rgb[idx+2] = palette[pal+2];

				data[index*4+0] = rgb[idx];
				data[index*4+1] = rgb[idx+1];
				data[index*4+2] = rgb[idx+2];
				data[index*4+3] = 255;
			}
		}

		var log2 = Math.log(2);
		var pow2 = Math.ceil(Math.log(tex.width) / log2);
		var newWidth = Math.pow(2, pow2);
		pow2 = Math.ceil(Math.log(tex.height) / log2);
		var newHeight = Math.pow(2, pow2);

		ctx.putImageData(idata, 0,0);

		var width = tex.width;
		var height = tex.height;

		if (newWidth != tex.width || newHeight != tex.height)
		{
			var cv = document.createElement("canvas");
			var cvctx = cv.getContext("2d");
			cv.width = newWidth;
			cv.height = newHeight;

			cvctx.drawImage(canvas, 0, 0, tex.width, tex.height, 0, 0, newWidth, newHeight);
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

		if (HLMDL.ShowTextures) document.body.appendChild(canvas);

		tex.image = {};
		tex.image.org_width = tex.width;
		tex.image.org_height = tex.height;
		this.textures.push(tex.image);
		this.buildTexture(tex.image, tex, width, height, rgb);
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
	},

	readBodyParts: function(buffer, header)
	{
		this.bodyParts = mdlBodyParts_t.readStructs(buffer, header.bodypartindex, header.numbodyparts);
		HLMDL.Debug && console.log("Body parts: ", this.bodyParts);



		for (var i=0; i<header.numbodyparts; i++)
		{
			var model = mdlModel_t.readStructs(buffer, this.bodyParts[i].modelindex, 1)[0];
			this.models.push(model);
			HLMDL.Debug && console.log("Model: ", model);

			model.meshes = mdlMesh_t.readStructs(buffer, model.meshindex, model.nummesh);
			HLMDL.Debug && console.log("Meshes: ", model.meshes);

			model.verts = new Float32Array(buffer, model.vertindex, model.numverts * 3);
			//HLMDL.Debug && console.log(model.verts);

			for (var j=0; j<model.meshes.length; j++)
				this.readMesh(buffer, model, model.meshes[j]);
		}
	},

	readMesh: function(buffer, model, mesh)
	{
		var tris = new Int16Array(buffer, mesh.triindex, Math.floor((this.header.length-mesh.triindex)/2));
		//HLMDL.Debug && console.log("Tris: ", tris);

		var vertBuffer = [];
		var faceVerts = [];

		mesh.texture = this.textures[this.skinref[mesh.skinref]];



		var count, i = 0;
		while (count = tris[i++])
		{
			var fan = false;
			var start = null;
			var stripcount = 0;
			var len = 0;

			if (count < 0)
			{
				fan = true;
				count = -count;
			}

			for (; count>0; count--)
			{
				var vert  = tris[i++] * 3;
				var light = tris[i++];
				var coord = [ tris[i++], tris[i++] ];

				///HLMDL.Debug && console.log(vert, light, coord[0], coord[1]);

				var pos = [
					model.verts[vert+0],
					model.verts[vert+1],
					model.verts[vert+2]
				];

				var uv = [ coord[0] / mesh.texture.org_width, coord[1] / mesh.texture.org_height];

				var v = {
					pos: pos,
					uv: uv,
					vindex: vert/3
				};

				if (!fan)
				{
					if (len > 2)
					{
						if (((++stripcount) % 2) == 1)
						{
							var a = faceVerts[faceVerts.length-2];
							var b = faceVerts[faceVerts.length-1];

							faceVerts.push(b);		// last one
							faceVerts.push(a);		// last but one
							faceVerts.push(v);		// new one
						}
						else
						{
							var a = faceVerts[faceVerts.length-3];
							var b = faceVerts[faceVerts.length-1];

							faceVerts.push(a);		// previosuly first one
							faceVerts.push(b);		// last one
							faceVerts.push(v);		// new one
						}
					}
					else
					{
						faceVerts.push(v);
						len += 1;
					}
				}
				else
				{
					if (fan && !start) start = v;

					if (len > 2)
					{
						var a = start;
						var b = faceVerts[faceVerts.length-1];
						faceVerts.push(a);
						faceVerts.push(b);
					}

					faceVerts.push(v);
					len += 1;
				}
			}
		}

		// vertices must be transformed by the bone transformation matrix

		var vertbone = new Uint8Array(buffer, model.vertinfoindex, model.numverts);

		var glArray = new Float32Array(faceVerts.length * 5);
		var offset = 0;
		for (var i=0; i<faceVerts.length; i++)
		{
			var vert = faceVerts[i];

			vert._pos = [0,0,0];

			VectorTransform(vert.pos, this.bonetransforms[vertbone[vert.vindex]], vert._pos);

			glArray[offset++] = vert._pos[0];
			glArray[offset++] = vert._pos[1];
			glArray[offset++] = vert._pos[2];
			glArray[offset++] = vert.uv[0];
			glArray[offset++] = vert.uv[1];
		}

		mesh.vertBuffer = gl.createBuffer();
		mesh.vertCount = faceVerts.length;

		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, glArray, gl.STATIC_DRAW);
	},

	getAnims: function(buffer, seqDesc)
	{
		var seqGroup = mdlSeqGroup_t.readStructs(buffer, this.header.seqgroupindex + seqDesc.seqgroup, 1)[0];
		HLMDL.Debug && console.log("SeqGroup:", seqGroup);

		if (seqDesc.seqgroup == 0)
		{
			var anims = mdlAnim_t.readStructs(buffer, seqGroup.data + seqDesc.animindex, this.header.numbones);	// !!!!
			for (var i=0; i<anims.length; i++)
				anims[i].index = seqGroup.data + seqDesc.animindex + i*mdlAnim_t.byteLength;
			return anims;
		}

		console.error("Animation model needed");
		return null;
	},

	calcBoneAdj: function()
	{
		// TODO
	},

	calcBoneQuaternion: function(buffer, frame, s, bone, anim, q, animindex)
	{
		var j, k;
		var q1 = new Array(4), q2 = new Array(4);
		var angle1 = new Array(3), angle2 = new Array(3);

		for (var j=0; j<3; j++)
		{
			if (anim.offset[j+3] == 0)
			{
				angle2[j] = angle1[j] = bone.value[j+3];
			}
			else
			{
				var animvalues = mdlAnimValue_t.readStructs(buffer, animindex + anim.offset[j+3], 255);	// !!!!
				var animvalue = animvalues[0];
				HLMDL.Debug && console.log("AnimValue:", animvalue);
				k = frame;

				while (animvalue.total <= k)
				{
					k -= animvalue.total;
					animvalue += animvalue.valid + 1;
				}

				if (animvalue.valid > k)
				{
					angle1[j] = animvalues[k+1].value;

					if (animvalue.valid > k + 1)
					{
						angle2[j] = animvalues[k+2].value;
					}
					else
					{
						if (animvalue.total > k+1)
							angle2[j] = angle1[k];
						else
							angle2[j] = animvalue[animvalue.valid+2].value;
					}
				}
				else
				{
					HLMDL.Debug && console.log(animvalue.valid)
					angle1[j] = animvalues[animvalue.valid].value;
					if (animvalue.total > k + 1)
					{
						angle2[j] = angle1[j];
					}
					else
					{
						angle2[j] = animvalues[animvalue.valid + 2].value;
					}
				}
				angle1[j] = bone.value[j+3] + angle1[j] * bone.scale[j+3];
				angle2[j] = bone.value[j+3] + angle2[j] * bone.scale[j+3];
			}

			if (bone.bonecontroller[j+3] != -1)
			{
				//angle1[j] += m_adj[pbone->bonecontroller[j+3]];		// TODO: m_adj
				//angle2[j] += m_adj[pbone->bonecontroller[j+3]];
			}
		}

		if (!VectorCompare(angle1, angle2))
		{
			AngleQuaternion( angle1, q1 );
			AngleQuaternion( angle2, q2 );
			QuaternionSlerp( q1, q2, s, q );
		}
		else
		{
			AngleQuaternion( angle1, q );
		}
	},

	calcBonePosition: function(buffer, frame, s, bone, anim, pos, animindex )
	{
		var	j, k;

		for (j = 0; j < 3; j++)
		{
			pos[j] = bone.value[j]; // default;
			if (anim.offset[j] != 0)
			{
				var panimvalues = mdlAnimValue_t.readStructs(buffer, animindex + anim.offset[j], 255);	// !!!!
				var panimvalue = panimvalues[0];

				k = frame;
				// find span of values that includes the frame we want
				while (panimvalue.total <= k)
				{
					k -= panimvalue.total;
					panimvalue += panimvalue.valid + 1;
				}
				// if we're inside the span
				if (panimvalue.valid > k)
				{
					// and there's more data in the span
					if (panimvalue.valid > k + 1)
					{
						pos[j] += (panimvalues[k+1].value * (1.0 - s) + s * panimvalues[k+2].value) * bone.scale[j];
					}
					else
					{
						pos[j] += panimvalues[k+1].value * bone.scale[j];
					}
				}
				else
				{
					// are we at the end of the repeating values section and there's another section with data?
					if (panimvalue.total <= k + 1)
					{
						pos[j] += (panimvalues[panimvalue.valid].value * (1.0 - s) + s * panimvalues[panimvalue.valid + 2].value) * bone.scale[j];
					}
					else
					{
						pos[j] += panimvalues[panimvalue.valid].value * bone.scale[j];
					}
				}
			}
			if (bone.bonecontroller[j] != -1)
			{
				//pos[j] += m_adj[pbone->bonecontroller[j]];		// TODO
			}
		}
	},

	calcRotations: function(buffer, pos, q, seqDesc, anims, f, bones)
	{
		var frame = f|0;
		var s = f - frame;

		this.calcBoneAdj();

		for (var i=0; i<bones.length; i++)
		{
			var bone = bones[i];
			var anim = anims[i];		// !!!!
			this.calcBoneQuaternion(buffer, frame, s, bone, anim, q[i], anim.index);
			this.calcBonePosition(buffer, frame, s, bone, anim, pos[i], anim.index);
		}

		if (seqDesc.moptiontype & STUDIO_X) pos[seqDesc.motionbone][0] = 0;
		if (seqDesc.moptiontype & STUDIO_Y) pos[seqDesc.motionbone][1] = 0;
		if (seqDesc.moptiontype & STUDIO_Y) pos[seqDesc.motionbone][2] = 0;
	},

	setupBones: function(buffer)
	{
		var seqDesc = mdlSeqDesc_t.readStructs(buffer, this.header.seqindex, 1)[0];
		HLMDL.Debug && console.log("SeqDesc:", seqDesc);

		var anims = this.getAnims(buffer, seqDesc);
		HLMDL.Debug && console.log("Anims: ", anims);

		var pos = new Array(128);
		var bonematrix = [[0,0,0,0],[0,0,0,0],[0,0,0,0]];
		var q = new Array(128);
		var pos2 = new Array(128);
		var q2 = new Array(128);
		var pos3 = new Array(128);
		var q3 = new Array(128);
		var pos4 = new Array(128);
		var q4 = new Array(128);

		for (var i=0; i<128; i++)
		{
			q[i] = [0,0,0,0];
			q2[i] = [0,0,0,0];
			q3[i] = [0,0,0,0];
			q4[i] = [0,0,0,0];

			pos[i] = [0,0,0];
			pos2[i] = [0,0,0];
			pos3[i] = [0,0,0];
			pos4[i] = [0,0,0];
		}

		var frame = 0;

		var bones = mdlBone_t.readStructs(buffer, this.header.boneindex, this.header.numbones);
		HLMDL.Debug && console.log("Bones:", bones);

		this.calcRotations(buffer, pos, q, seqDesc, anims, frame, bones );


		this.bonetransforms = [];
		for (var i=0; i<128; i++)
		{
			var a = [[0,0,0,0],[0,0,0,0],[0,0,0,0]];
			this.bonetransforms.push(a);
		}

		//if (seqDesc.numblends > 1) alert(seqDesc.numblends)

		for (var i=0; i<this.header.numbones; i++)
		{
			QuaternionMatrix( q[i], bonematrix );

			bonematrix[0][3] = pos[i][0];
			bonematrix[1][3] = pos[i][1];
			bonematrix[2][3] = pos[i][2];

			//HLMDL.Debug && console.log("transform: ",bones[i].parent);

			if (bones[i].parent == -1)
			{
				var a = this.bonetransforms[i];

				for (var x=0; x<3; x++)
					for (var y=0; y<4; y++)
					{
						a[x][y] = bonematrix[x][y];
					}
			}
			else
			{
				//HLMDL.Debug && console.log(this.bonetransforms[bones[i].parent])
				R_ConcatTransforms(this.bonetransforms[bones[i].parent], bonematrix, this.bonetransforms[i]);
			}
		}

		// fix vertices
	},

	draw: function(shader)
	{
		gl.enableVertexAttribArray(shader.attribute.position);
		gl.enableVertexAttribArray(shader.attribute.texCoord);
		gl.enableVertexAttribArray(shader.attribute.texCoord2);

		gl.disable(gl.CULL_FACE);


		for (var i=0; i<this.models.length; i++)
		{
			var model = this.models[i];

			for (var j=0; j<model.meshes.length; j++)
			{
				var mesh = model.meshes[j];

				if (mesh.vertBuffer == null/* || !mesh.texture*/) continue;

				gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertBuffer);

				gl.vertexAttribPointer(shader.attribute.position, 3, gl.FLOAT, false, HLMDL.Stride, 0);
				gl.vertexAttribPointer(shader.attribute.texCoord, 2, gl.FLOAT, false, HLMDL.Stride, 3 * 4);
				gl.vertexAttribPointer(shader.attribute.texCoord2, 2, gl.FLOAT, false, HLMDL.Stride, 3 * 4);

				if (shader.uniform.diffuse)
					gl.uniform1i(shader.uniform.diffuse, 0);

				// Bind the texture
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, mesh.texture.texture);

				gl.drawArrays(gl.TRIANGLES, 0, mesh.vertCount);
			}
		}
	}
}
