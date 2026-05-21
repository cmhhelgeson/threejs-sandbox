import { MeshPhongMaterial, Color } from 'three';
import { MeshPhongNodeMaterial } from 'three/webgpu';
import { Fn, vec3, vec4, diffuseColor, min, uniform, mix } from 'three/tsl';

// Use if you are targetting both the WebGLRenderer and the WebGPURenderer (requires passing in WebGLNodesHandler())
export class ColoredShadowNodeMaterial extends MeshPhongNodeMaterial {

	static get type() {

		return `ColoredShadowNodeMaterial`;

	}

	constructor( parameters = {} ) {

		super( parameters );
		this._shadowColor = uniform( new Color( parameters.shadowColor ?? 0xff0000 ) );

	}

	get shadowColor() {

		return this._shadowColor.value;

	}

	set shadowColor( val ) {

		this._shadowColor.value.set( val );

	}

	setupOutput( builder, outputNode ) {

		const brightness = min( outputNode.r, 1.0 );
		const mixedColor = mix( this._shadowColor, diffuseColor.rgb, brightness );

		return super.setupOutput( builder, vec4( mixedColor, outputNode.a ) );

	}

}


// Use if you are exclusively targeting the WebGLRenderer

export class ColoredShadowMaterial extends MeshPhongMaterial {

	constructor( parameters = {} ) {

		super( parameters );
		this.shadowColor = new Color( parameters.shadowColor ?? 0xff0000 );

	}

	onBeforeCompile( shader ) {

		shader.uniforms.shadowColor = { value: this.shadowColor };
		shader.fragmentShader = 'uniform vec3 shadowColor;\n' + shader.fragmentShader;
		shader.fragmentShader = shader.fragmentShader.replace(
			'#include <dithering_fragment>',
			`#include <dithering_fragment>
			gl_FragColor.rgb = mix( shadowColor.rgb, diffuse, min( gl_FragColor.r, 1.0 ) );`
		);

	}

	customProgramCacheKey() {

		return 'ColoredShadowMaterial';

	}

}
