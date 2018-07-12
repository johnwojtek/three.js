/**
 * @author sunag / http://www.sunag.com.br/
 */

import { NodeUniform } from './NodeUniform.js';
import { NodeUtils } from './NodeUtils.js';
import { NodeLib } from './NodeLib.js';
import { FunctionNode } from './FunctionNode.js';
import { ConstNode } from './ConstNode.js';
import { StructNode } from './StructNode.js';
import { Vector2Node } from '../inputs/Vector2Node.js';
import { Vector3Node } from '../inputs/Vector3Node.js';
import { Vector4Node } from '../inputs/Vector4Node.js';
import { TextureNode } from '../inputs/TextureNode.js';
import { CubeTextureNode } from '../inputs/CubeTextureNode.js';

var elements = NodeUtils.elements,
	constructors = [ 'float', 'vec2', 'vec3', 'vec4' ],
	convertFormatToType = {
		float: 'f',
		vec2: 'v2',
		vec3: 'v3',
		vec4: 'v4',
		mat4: 'v4',
		int: 'i'
	},
	convertTypeToFormat = {
		t: 'sampler2D',
		tc: 'samplerCube',
		b: 'bool',
		i: 'int',
		f: 'float',
		c: 'vec3',
		v2: 'vec2',
		v3: 'vec3',
		v4: 'vec4',
		m3: 'mat3',
		m4: 'mat4'
	};
 
function NodeBuilder() {

	this.caches = [];
	this.slots = [];

	this.keywords = {};
	
	this.nodeData = {};
	
	this.requires = {
		uv: [],
		color: [],
		lights: false,
		fog: false
	};

	this.includes = {
		consts: [],
		functions: [],
		structs: []
	};
	
	this.attributes = {};
	
	this.prefixCode = [
		"#ifdef GL_EXT_shader_texture_lod",

		"	#define texCube(a, b) textureCube(a, b)",
		"	#define texCubeBias(a, b, c) textureCubeLodEXT(a, b, c)",

		"	#define tex2D(a, b) texture2D(a, b)",
		"	#define tex2DBias(a, b, c) texture2DLodEXT(a, b, c)",

		"#else",

		"	#define texCube(a, b) textureCube(a, b)",
		"	#define texCubeBias(a, b, c) textureCube(a, b, c)",

		"	#define tex2D(a, b) texture2D(a, b)",
		"	#define tex2DBias(a, b, c) texture2D(a, b, c)",

		"#endif",

		"#include <packing>"

	].join( "\n" );
	
	this.parsCode = {
		vertex: '',
		fragment: ''
	};
	
	this.code = {
		vertex: '',
		fragment: ''
	};
	
	this.nodeCode = {
		vertex: '',
		fragment: ''
	};
	
	this.resultCode = {
		vertex: '',
		fragment: ''
	};
	
	this.finalCode = {
		vertex: '',
		fragment: ''
	};
	
	this.inputs = {
		uniforms: {
			list: [],
			vertex: [],
			fragment: []
		},
		vars: {
			varying: [],
			vertex: [],
			fragment: []
		}
	};
	
	// send to material
	
	this.defines = {};
	
	this.uniforms = {};
	
	this.extensions = {};
	
	this.updaters = [];
	
	this.nodes = [];
	
	// --
	
	this.parsing = false;
	this.optimize = true;

	this.update();

};

NodeBuilder.prototype = {

	constructor: NodeBuilder,

	build: function( vertex, fragment ) {
		
		this.buildShader( 'vertex', vertex );
		this.buildShader( 'fragment', fragment );
		
		if ( this.requires.uv[ 0 ] ) {

			this.addVaryCode( 'varying vec2 vUv;' );
		
			this.addVertexFinalCode( 'vUv = uv;' );

		}
		
		if ( this.requires.uv[ 1 ] ) {

			this.addVaryCode( 'varying vec2 vUv2;' );
			this.addVertexParsCode( 'attribute vec2 uv2;' );

			this.addVertexFinalCode( 'vUv2 = uv2;' );

		}
		
		if ( this.requires.color[ 0 ] ) {

			this.addVaryCode( 'varying vec4 vColor;' );
			this.addVertexParsCode( 'attribute vec4 color;' );

			this.addVertexFinalCode( 'vColor = color;' );

		}
		
		if ( this.requires.color[ 1 ] ) {

			this.addVaryCode( 'varying vec4 vColor2;' );
			this.addVertexParsCode( 'attribute vec4 color2;' );

			this.addVertexFinalCode( 'vColor2 = color2;' );

		}
		
		if ( this.requires.position ) {

			this.addVaryCode( 'varying vec3 vPosition;' );

			this.addVertexFinalCode( 'vPosition = transformed;' );

		}
		
		if ( this.requires.worldPosition ) {

			this.addVaryCode( 'varying vec3 vWPosition;' );
			
			this.addVertexFinalCode( 'vWPosition = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;' );

		}
		
		if ( this.requires.normal ) {

			this.addVaryCode( 'varying vec3 vObjectNormal;' );

			this.addVertexFinalCode( 'vObjectNormal = normal;' );

		}
		
		if ( this.requires.worldNormal ) {

			this.addVaryCode( 'varying vec3 vWNormal;' );

			this.addVertexFinalCode( 'vWNormal = ( modelMatrix * vec4( objectNormal, 0.0 ) ).xyz;' );

		}
		
		return this;
		
	},
	
	buildShader: function( shader, node ) {
		
		this.resultCode[shader] = node.build( this.setShader( shader ), 'v4' );
		
	},
	
	setMaterial: function( material, renderer ) {
		
		this.material = material;
		this.renderer = renderer;
		
		this.requires.lights = material.lights;
		this.requires.fog = material.fog;
		
		return this;
		
	},
	
	addCache: function ( name, context ) {

		this.caches.push( {
			name: name || '',
			context: context || {}
		} );

		return this.update();

	},

	removeCache: function () {

		this.caches.pop();

		return this.update();

	},

	addSlot: function ( name ) {

		this.slots.push( {
			name: name || ''
		} );

		return this.update();

	},

	removeSlot: function () {

		this.slots.pop();

		return this.update();

	},

	
	addVertexCode: function ( code ) {

		this.addCode( code, 'vertex' );

	},

	addFragmentCode: function ( code ) {

		this.addCode( code, 'fragment' );

	},
	
	addCode: function ( code, shader ) {

		this.code[shader || this.shader] += code + '\n';

	},
	
	
	addVertexNodeCode: function ( code ) {

		this.addNodeCode( code, 'vertex' );

	},

	addFragmentNodeCode: function ( code ) {

		this.addNodeCode( code, 'fragment' );

	},
	
	addNodeCode: function ( code, shader ) {

		this.nodeCode[shader || this.shader] += code + '\n';

	},
	
	clearNodeCode: function ( shader ) {

		shader = shader || this.shader;
	
		var code = this.nodeCode[shader];
		
		this.nodeCode[shader] = '';

		return code;
		
	},
	
	clearVertexNodeCode: function (  ) {

		return this.clearNodeCode( 'vertex' );

	},
	
	clearFragmentNodeCode: function (  ) {

		return this.clearNodeCode( 'fragment' );

	},
	
	addVertexFinalCode: function ( code ) {

		this.addFinalCode( code, 'vertex' );

	},

	addFragmentFinalCode: function ( code ) {

		this.addFinalCode( code, 'fragment' );

	},
	
	addFinalCode: function ( code, shader ) {

		this.finalCode[shader || this.shader] += code + '\n';

	},
	
	
	addVertexParsCode: function ( code ) {

		this.addParsCode( code, 'vertex' );

	},
	
	addFragmentParsCode: function ( code ) {

		this.addParsCode( code, 'fragment' );

	},
	
	addParsCode: function ( code, shader ) {

		this.parsCode[shader || this.shader] += code + '\n';

	},
	
	
	addVaryCode: function ( code ) {

		this.addVertexParsCode( code );
		this.addFragmentParsCode( code );

	},
	
	
	isCache: function ( name ) {

		var i = this.caches.length;

		while ( i -- ) {

			if ( this.caches[ i ].name === name ) return true;

		}

		return false;

	},

	isSlot: function ( name ) {

		var i = this.slots.length;

		while ( i -- ) {

			if ( this.slots[ i ].name === name ) return true;

		}

		return false;

	},

	update: function () {

		var cache = this.caches[ this.caches.length - 1 ];
		var slot = this.slots[ this.slots.length - 1 ];

		this.slot = slot ? slot.name : '';
		this.cache = cache ? cache.name : '';
		this.context = cache ? cache.context : {};

		return this;

	},

	define: function ( name, value ) {

		this.defines[ name ] = value === undefined ? 1 : value;

	},
	
	isDefined: function ( name ) {

		return this.defines[ name ] !== undefined;

	},

	getVar: function ( uuid, type, ns, shader ) {

		shader = shader || 'varying';
	
		var vars = this.getVars(shader),
			data = vars[ uuid ];

		if ( ! data ) {

			var index = vars.length,
				name = ns ? ns : 'nVv' + index;

			data = { name: name, type: type };

			vars.push( data );
			vars[ uuid ] = data;

		}

		return data;

	},
	
	getTempVar: function ( uuid, type, ns ) {

		return this.getVar( uuid, type, ns, this.shader );

	},
	
	getAttribute: function ( name, type ) {

		if ( ! this.attributes[ name ] ) {

			var varying = this.getVar( name, type );

			this.addVertexParsCode( 'attribute ' + type + ' ' + name + ';' );
			this.addVertexFinalCode( varying.name + ' = ' + name + ';' );

			this.attributes[ name ] = { varying: varying, name: name, type: type };

		}

		return this.attributes[ name ];

	},
	
	getCode: function( shader ) {
		
		return [
			this.prefixCode,
			this.parsCode[ shader ],
			this.getVarListCode( this.getVars('varying'), 'varying' ),
			this.getVarListCode( this.inputs.uniforms[shader], 'uniform' ),
			this.getIncludesCode( 'consts', shader ),
			this.getIncludesCode( 'structs', shader ),
			this.getIncludesCode( 'functions', shader ),
			'void main() {',
				this.getVarListCode( this.getVars(shader) ),
				this.code[ shader ], 
				this.resultCode[ shader ],
				this.finalCode[ shader ],
			'}'
		].join( "\n" );
		
	},
	
	getVarListCode: function ( vars, prefix ) {

		prefix = prefix || '';
	
		var code = '';

		for ( var i = 0, l = vars.length; i < l; ++ i ) {

			var nVar = vars[i],
				type = nVar.type,
				name = nVar.name;
			
			var formatType = this.getFormatByType( type );

			if ( formatType === undefined ) {
				
				throw new Error( "Node pars " + formatType + " not found." );
				
			}

			code += prefix + ' ' + formatType + ' ' + name + ';\n';

		}

		return code;

	},
	
	getVars: function ( shader ) {

		return this.inputs.vars[ shader || this.shader ];

	},
	
	getNodeData: function ( node ) {

		var uuid = node.isNode ? node.uuid : node;
	
		return this.nodeData[ uuid ] = this.nodeData[ uuid ] || {};

	},
	
	createUniform: function ( shader, type, node, ns, needsUpdate ) {

		var uniforms = this.inputs.uniforms,
			index = uniforms.list.length;

		var uniform = new NodeUniform( {
			type: type,
			name: ns ? ns : 'nVu' + index + '_' + THREE.Math.generateUUID().substr(0, 8),
			node: node,
			needsUpdate: needsUpdate
		} );

		uniforms.list.push( uniform );

		uniforms[shader].push( uniform );
		uniforms[shader][ uniform.name ] = uniform;
		
		this.uniforms[ uniform.name ] = uniform;
		
		return uniform;

	},
	
	createVertexUniform: function ( type, node, ns, needsUpdate ) {

		return this.createUniform( 'vertex', type, node, ns, needsUpdate );

	},
	
	createFragmentUniform: function ( type, node, ns, needsUpdate ) {

		return this.createUniform( 'fragment', type, node, ns, needsUpdate );

	},
	
	include: function ( node, parent, source ) {

		var includesStruct;

		node = typeof node === 'string' ? NodeLib.get( node ) : node;

		if ( node instanceof FunctionNode ) {

			includesStruct = this.includes.functions;

		} else if ( node instanceof ConstNode ) {

			includesStruct = this.includes.consts;
			
		} else if ( node instanceof StructNode ) {

			includesStruct = this.includes.structs;

		}
		
		var includes = includesStruct[ this.shader ] = includesStruct[ this.shader ] || [];

		if (node) {
		
			var included = includes[ node.name ];

			if ( ! included ) {

				included = includes[ node.name ] = {
					node: node,
					deps: []
				};

				includes.push( included );

				included.src = node.build( this, 'source' );

			}

			if ( node instanceof FunctionNode && parent && includes[ parent.name ] && includes[ parent.name ].deps.indexOf( node ) == - 1 ) {

				includes[ parent.name ].deps.push( node );

				if ( node.includes && node.includes.length ) {

					var i = 0;

					do {

						this.include( node.includes[ i ++ ], parent );

					} while ( i < node.includes.length );

				}

			}

			if ( source ) {

				included.src = source;

			}
			
			return node.name;
			
		} else {
			
			throw new Error("Include not found.");
			
		}

	},

	colorToVectorProperties: function ( color ) {

		return color.replace( 'r', 'x' ).replace( 'g', 'y' ).replace( 'b', 'z' ).replace( 'a', 'w' );

	},
	
	colorToVector: function ( color ) {

		return color.replace( /c/g, 'v3' );

	},

	getIncludes: function ( type, shader ) {

		return this.includes[type][shader || this.shader];

	},
	
	getIncludesCode: function () {

		function sortByPosition( a, b ) {

			return a.deps.length - b.deps.length;

		}

		return function getIncludesCode( type, shader ) {

			var includes = this.getIncludes( type, shader );
	
			if ( ! includes ) return '';

			var code = '', 
				includes = includes.sort( sortByPosition );

			for ( var i = 0; i < includes.length; i ++ ) {

				if ( includes[ i ].src ) code += includes[ i ].src + '\n';

			}

			return code;

		};

	}(),
	
	getConstructorFromLength: function ( len ) {

		return constructors[ len - 1 ];

	},

	isTypeMatrix: function ( format ) {

		return /^m/.test( format );

	},

	getTypeLength: function ( type ) {

		if ( type === 'f' ) return 1;
	
		return parseInt( this.colorToVector( type ).substr( 1 ) );

	},

	getTypeFromLength: function ( len ) {

		if ( len === 1 ) return 'f';

		return 'v' + len;

	},
	
	findNode: function() {
		
		for(var i = 0; i < arguments.length; i++) {
			
			var nodeCandidate = arguments[i];
			
			if (nodeCandidate !== undefined && nodeCandidate.isNode) {
				
				return nodeCandidate;
				
			}
			
		}
		
	},
	
	resolve: function() {
		
		for(var i = 0; i < arguments.length; i++) {
			
			var nodeCandidate = arguments[i];
			
			if (nodeCandidate !== undefined) {
				
				if (nodeCandidate.isNode) {
				
					return nodeCandidate;
					
				} else if (nodeCandidate.isTexture) {
					
					switch( nodeCandidate.mapping ) {
					
						case THREE.CubeReflectionMapping:
						case THREE.CubeRefractionMapping:

							return new CubeTextureNode( nodeCandidate );

							break;
						
						case THREE.CubeUVReflectionMapping:
						case THREE.CubeUVRefractionMapping:

							return new TextureCubeNode( new TextureNode( nodeCandidate ) );

							break;
							
						default:
						
							return new TextureNode( nodeCandidate );
						
					}
					
				} else if (nodeCandidate.isVector2) {
					
					return new Vector2Node( nodeCandidate );
					
				} else if (nodeCandidate.isVector3) {
					
					return new Vector3Node( nodeCandidate );
					
				} else if (nodeCandidate.isVector4) {
					
					return new Vector4Node( nodeCandidate );
					
				}
				
			}
			
		}
		
	},

	format: function ( code, from, to ) {

		var typeToType = this.colorToVector( to + ' = ' + from );

		switch ( typeToType ) {

			case 'f = v2': return code + '.x';
			case 'f = v3': return code + '.x';
			case 'f = v4': return code + '.x';
			case 'f = i': return 'float( ' + code + ' )';

			case 'v2 = f': return 'vec2( ' + code + ' )';
			case 'v2 = v3': return code + '.xy';
			case 'v2 = v4': return code + '.xy';
			case 'v2 = i': return 'vec2( float( ' + code + ' ) )';

			case 'v3 = f': return 'vec3( ' + code + ' )';
			case 'v3 = v2': return 'vec3( ' + code + ', 0.0 )';
			case 'v3 = v4': return code + '.xyz';
			case 'v3 = i': return 'vec2( float( ' + code + ' ) )';

			case 'v4 = f': return 'vec4( ' + code + ' )';
			case 'v4 = v2': return 'vec4( ' + code + ', 0.0, 1.0 )';
			case 'v4 = v3': return 'vec4( ' + code + ', 1.0 )';
			case 'v4 = i': return 'vec4( float( ' + code + ' ) )';

			case 'i = f': return 'int( ' + code + ' )';
			case 'i = v2': return 'int( ' + code + '.x )';
			case 'i = v3': return 'int( ' + code + '.x )';
			case 'i = v4': return 'int( ' + code + '.x )';

		}

		return code;

	},

	getTypeByFormat: function ( format ) {

		return convertFormatToType[ format ] || format;

	},
	
	getFormatByType: function ( type ) {

		return convertTypeToFormat[ type ] || type;

	},

	getUuid: function ( uuid, useCache ) {

		useCache = useCache !== undefined ? useCache : true;

		if ( useCache && this.cache ) uuid = this.cache + '-' + uuid;

		return uuid;

	},

	getElementByIndex: function ( index ) {

		return elements[ index ];

	},

	getIndexByElement: function ( elm ) {

		return elements.indexOf( elm );

	},

	isShader: function ( shader ) {

		return this.shader === shader;

	},

	setShader: function ( shader ) {

		this.shader = shader;

		return this;

	},
	
	mergeUniform: function ( uniforms ) {

		for ( var name in uniforms ) {

			this.uniforms[ name ] = uniforms[ name ];

		}

	},

	getTexelDecodingFunctionFromTexture: function( code, texture ) {

		var gammaOverrideLinear = this.getTextureEncodingFromMap( texture, this.context.gamma && ( this.renderer ? this.renderer.gammaInput : false ) )

		return this.getTexelDecodingFunction( code, gammaOverrideLinear );

	},

	getTexelDecodingFunction: function( value, encoding ) {

		var components = this.getEncodingComponents( encoding );

		return components[ 0 ] + 'ToLinear' + components[ 1 ].replace( 'value', value );

	},

	getTexelEncodingFunction: function( value, encoding ) {

		var components = this.getEncodingComponents( encoding );

		return 'LinearTo' + components[ 0 ] + components[ 1 ].replace( 'value', value );

	},

	getEncodingComponents: function( encoding ) {

		switch ( encoding ) {

			case THREE.LinearEncoding:
				return [ 'Linear', '( value )' ];
			case THREE.sRGBEncoding:
				return [ 'sRGB', '( value )' ];
			case THREE.RGBEEncoding:
				return [ 'RGBE', '( value )' ];
			case THREE.RGBM7Encoding:
				return [ 'RGBM', '( value, 7.0 )' ];
			case THREE.RGBM16Encoding:
				return [ 'RGBM', '( value, 16.0 )' ];
			case THREE.RGBDEncoding:
				return [ 'RGBD', '( value, 256.0 )' ];
			case THREE.GammaEncoding:
				return [ 'Gamma', '( value, float( GAMMA_FACTOR ) )' ];
			default:
				throw new Error( 'unsupported encoding: ' + encoding );

		}

	},

	getEncodingComponents: function( encoding ) {

		switch ( encoding ) {

			case THREE.LinearEncoding:
				return [ 'Linear', '( value )' ];
			case THREE.sRGBEncoding:
				return [ 'sRGB', '( value )' ];
			case THREE.RGBEEncoding:
				return [ 'RGBE', '( value )' ];
			case THREE.RGBM7Encoding:
				return [ 'RGBM', '( value, 7.0 )' ];
			case THREE.RGBM16Encoding:
				return [ 'RGBM', '( value, 16.0 )' ];
			case THREE.RGBDEncoding:
				return [ 'RGBD', '( value, 256.0 )' ];
			case THREE.GammaEncoding:
				return [ 'Gamma', '( value, float( GAMMA_FACTOR ) )' ];
			default:
				throw new Error( 'unsupported encoding: ' + encoding );

		}

	},
	
	getTextureEncodingFromMap: function ( map, gammaOverrideLinear ) {

		var encoding;

		if ( ! map ) {

			encoding = THREE.LinearEncoding;

		} else if ( map.isTexture ) {

			encoding = map.encoding;

		} else if ( map.isWebGLRenderTarget ) {

			console.warn( "THREE.WebGLPrograms.getTextureEncodingFromMap: don't use render targets as textures. Use their .texture property instead." );
			encoding = map.texture.encoding;

		}

		// add backwards compatibility for WebGLRenderer.gammaInput/gammaOutput parameter, should probably be removed at some point.
		if ( encoding === THREE.LinearEncoding && gammaOverrideLinear ) {

			encoding = THREE.GammaEncoding;

		}

		return encoding;

	}

};

export { NodeBuilder };