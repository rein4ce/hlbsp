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

// Globals
var Width 	= 800;
var Height 	= 600;
var gl 		= null;			// Global OpenGL object


/**
 * Main game object
 */
var Game = function()
{
	this.modelViewMat = mat4.create();
	this.projectionMat = mat4.create();
	this.camera = mat4.create();
	this.modelViewInvMat = mat3.create();
	this.cameraMat = mat4.create();

	this.cameraPosition = [0, 0, 0];
	this.speed = 15;
	this.zAngle = 3;
	this.xAngle = 0;

	this.frame = 0;
	this.pressed = new Array(128);

	this.activeShader = null;
	this.map = null;

	this.init();
}

Game.prototype =
{
	init: function()
	{
		// initialize canvas
		var canvas = document.getElementById("viewport");
		var overlay = document.getElementById("viewport-overlay");
		overlay.style.width = Width + "px";
		overlay.style.height = Height + "px";
		canvas.width = Width;
		canvas.height = Height;

		gl = getAvailableContext(canvas, ["webgl", "experimental-webgl"]);

		if (!gl)
		{
			alert("Error while obtaining WebGL Context");
		}
		else
		{
			this.initEvents();

			gl.viewportWidth = Width;
			gl.viewportHeight = Height;

			this.initGL();

			var self = this;

			// Draw Frames in quick succession
			setInterval(function()
			{
				self.drawFrame(self.activeShader);
				self.frame++;
			}, 1);
		}
	},

	loadMap: function(filename)
	{
		this.map = new HLBSP(filename);
		$("#loading").show();
	},

	initGL: function()
	{
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);

		gl.clearColor(177/255,217/255,249/255,1);
		gl.clearDepth(1);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl.FRONT);

		// setup matrices
		mat4.perspective(90.0, gl.viewportWidth/gl.viewportHeight, 1.0, 8192, this.projectionMat);
		mat4.identity(this.camera);

		this.initShaders(gl);
	},

	initShaders: function()
	{
		this.activeShader = createShaderProgram(gl, 'lightmap-vs', 'lightmap-fs');
	},

	drawFrame: function(shader)
	{
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// set default shader
		gl.useProgram(shader);



		// setup matrices
		mat4.identity(this.modelViewMat);
		mat4.rotateX(this.modelViewMat, this.xAngle-Math.PI/2);
		mat4.rotateZ(this.modelViewMat, this.zAngle);
		mat4.translate(this.modelViewMat, this.cameraPosition);

		gl.uniformMatrix4fv(shader.uniform.modelViewMat, false, this.modelViewMat);
		gl.uniformMatrix4fv(shader.uniform.projectionMat, false, this.projectionMat);

		if (this.map)
		{
			this.map.draw(shader);
			this.map.drawEntities(shader);
		}
	},

	initEvents: function()
	{
		var movingModel = false;
		var lastX = 0;
		var lastY = 0;
		var self = this;

		$(window).keydown(function(event) {
			self.pressed[event.keyCode] = true;
		});

		$(window).keyup(function(event) {
			self.pressed[event.keyCode] = false;
		});

		setInterval(function() {
			// This is our first person movement code. It's not really pretty, but it works
			var dir = [0, 0, 0];
			if(self.pressed['W'.charCodeAt(0)]) {
				dir[2] += self.speed;
			}
			if(self.pressed['S'.charCodeAt(0)]) {
				dir[2] -= self.speed;
			}
			if(self.pressed['A'.charCodeAt(0)]) {
				dir[0] += self.speed;
			}
			if(self.pressed['D'.charCodeAt(0)]) {
				dir[0] -= self.speed;
			}
			if(self.pressed[17]) {
				dir[1] += self.speed;
			}
			if(self.pressed[32]) {
				dir[1] -= self.speed;
			}

			mat4.identity(self.cameraMat);
			mat4.rotateX(self.cameraMat, self.xAngle-Math.PI/2);
			mat4.rotateZ(self.cameraMat, self.zAngle);
			mat4.inverse(self.cameraMat);

			mat4.multiplyVec3(self.cameraMat, dir);
			vec3.add(self.cameraPosition, dir);

		}, 33);

		$('#viewport').mousedown(function(event) {
			if(event.which == 1) {
				movingModel = true;
			}
			lastX = event.pageX;
			lastY = event.pageY;
		});

		$('#viewport').mouseup(function(event) {
			movingModel = false;
		});

		$('#viewport').mousemove(function(event) {
			var xDelta = event.pageX  - lastX;
			var yDelta = event.pageY  - lastY;
			lastX = event.pageX;
			lastY = event.pageY;

			if (movingModel) {
				self.zAngle += xDelta*0.025;
				while (self.zAngle < 0)
					self.zAngle += Math.PI*2;
				while (self.zAngle >= Math.PI*2)
					self.zAngle -= Math.PI*2;

				self.xAngle += yDelta*0.025;
				while (self.xAngle < -Math.PI*0.5)
					self.xAngle = -Math.PI*0.5;
				while (self.xAngle > Math.PI*0.5)
					self.xAngle = Math.PI*0.5;
			}
		});
	}
}


