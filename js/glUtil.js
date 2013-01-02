/*
 * glutil.js - Utility functions to simplify common tasks
 */

/*
 * Copyright (c) 2009 Brandon Jones
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

/*
 * Utility Functions
 */

function getAvailableContext(canvas, contextList) {
	if (canvas.getContext) {
		for (var i = 0; i < contextList.length; ++i) {
			try {
				var context = canvas.getContext(contextList[i], {alpha: false});
				if (context != null) return context;
			} catch (ex) {}
		}
	}
	return null;
}

function getShader(gl, id) {
	var shaderScript = document.getElementById(id);
	if (!shaderScript) return null;

	var str = '';
	var k = shaderScript.firstChild;
	while (k) {
		if (k.nodeType == 3) str += k.textContent;
		k = k.nextSibling;
	}

	var shader;
	if (shaderScript.type == 'x-shader/x-fragment') {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if (shaderScript.type == 'x-shader/x-vertex') {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		return null;
	}

	gl.shaderSource(shader, str);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.debug(gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}

function createShaderProgram(gl, vertexSrc, fragmentSrc) {
	var fragmentShader = getShader(gl, vertexSrc);
	var vertexShader = getShader(gl, fragmentSrc);

	var shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		gl.deleteProgram(shaderProgram);
		gl.deleteShader(vertexShader);
		gl.deleteShader(fragmentShader);
		console.debug('Could not initialise shaders');
		return null;
	}

	gl.useProgram(shaderProgram);

	shaderProgram.attribute = {};

	shaderProgram.attribute.position = gl.getAttribLocation(shaderProgram, 'position');
	shaderProgram.attribute.normal = gl.getAttribLocation(shaderProgram, 'normal');
	shaderProgram.attribute.texCoord = gl.getAttribLocation(shaderProgram, 'texCoord');
	shaderProgram.attribute.texCoord2 = gl.getAttribLocation(shaderProgram, 'texCoord2');
	shaderProgram.attribute.tangent = gl.getAttribLocation(shaderProgram, 'tangent');
	shaderProgram.attribute.color = gl.getAttribLocation(shaderProgram, 'color');

	shaderProgram.uniform = {};

	shaderProgram.uniform.time = gl.getUniformLocation(shaderProgram, 'time');
	shaderProgram.uniform.turbFactor = gl.getUniformLocation(shaderProgram, 'turbFactor');
	shaderProgram.uniform.turbTime = gl.getUniformLocation(shaderProgram, 'turbTime');

	shaderProgram.uniform.modelViewMat = gl.getUniformLocation(shaderProgram, 'modelViewMat');
	shaderProgram.uniform.projectionMat = gl.getUniformLocation(shaderProgram, 'projectionMat');
	shaderProgram.uniform.modelViewInvMat = gl.getUniformLocation(shaderProgram, 'modelViewInvMat');
	shaderProgram.uniform.texMat = gl.getUniformLocation(shaderProgram, 'texMat');

	shaderProgram.uniform.ambientLight = gl.getUniformLocation(shaderProgram, 'ambientLight');
	shaderProgram.uniform.lightPos = gl.getUniformLocation(shaderProgram, 'lightPos');
	shaderProgram.uniform.lightColor = gl.getUniformLocation(shaderProgram, 'lightColor');
	shaderProgram.uniform.specularColor = gl.getUniformLocation(shaderProgram, 'specularColor');
	shaderProgram.uniform.shininess = gl.getUniformLocation(shaderProgram, 'shininess');

	shaderProgram.uniform.diffuse = gl.getUniformLocation(shaderProgram, 'diffuse');
	shaderProgram.uniform.lightmap = gl.getUniformLocation(shaderProgram, 'lightmap');
	shaderProgram.uniform.specular = gl.getUniformLocation(shaderProgram, 'specular');
	shaderProgram.uniform.normalMap = gl.getUniformLocation(shaderProgram, 'normalMap');
	shaderProgram.uniform.alpha = gl.getUniformLocation(shaderProgram, 'alpha');

	return shaderProgram;
}

function createSolidTexture(gl, color) {
	var data = new Uint8Array(color);
	var texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, data);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	return texture;
}

function loadTexture(gl, src) {
	var texture = gl.createTexture();
	var image = new Image();
	image.onload = function() {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
		gl.generateMipmap(gl.TEXTURE_2D);
	}
	image.src = src;
	return texture;
}