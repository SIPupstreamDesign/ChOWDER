/**
 * @author Kai Salmen / www.kaisalmen.de
 */

'use strict';

var MeshSpray = {};

MeshSpray.Loader = function ( manager ) {
	this.manager = ( manager === null || manager === undefined ) ? THREE.DefaultLoadingManager : manager;
	this.logging = {
		enabled: true,
		debug: false
	};

	this.modelName;
	this.instanceNo = 0;
	this.baseObject3d = new THREE.Group();

	this.dataReceiver = new THREE.MeshTransfer.MeshReceiver();
};

MeshSpray.Loader.prototype = {

	constructor: MeshSpray.Loader,

	setLogging: function ( enabled, debug ) {
		this.logging.enabled = enabled === true;
		this.logging.debug = debug === true;
		this.dataReceiver.setLogging( this.logging.enabled, this.logging.debug );
	},

	setBaseObject3d: function ( baseObject3d ) {
		this.baseObject3d = ( baseObject3d === null || baseObject3d === undefined ) ? this.baseObject3d : baseObject3d;
	},

	_setCallbacks: function ( onParseProgress, onMeshAlter, onLoadMaterials ) {
		this.dataReceiver._setCallbacks( onParseProgress, onMeshAlter, onLoadMaterials );
	},

	buildWorkerCode: function ( codeSerializer ) {
		var workerCode = '';
		workerCode += '/**\n';
		workerCode += '  * This code was constructed by MeshSpray.buildWorkerCode.\n';
		workerCode += '  */\n\n';
		workerCode += 'MeshSpray = {};\n\n';
		workerCode += codeSerializer.serializeClass( 'MeshSpray.Parser', MeshSpray.Parser );

		return {
			code: workerCode,
			parserName: 'MeshSpray.Parser',
			libs: {
				locations: [ 'node_modules/three/build/three.min.js' ],
				path: '../../'
			},
			provideThree: true
		}
	}
};

MeshSpray.Parser = function () {
	this.sizeFactor = 0.5;
	this.localOffsetFactor = 1.0;
	this.globalObjectCount = 0;
	this.debug = false;
	this.dimension = 200;
	this.quantity = 1;
	this.callbackDataReceiver = null;
	this.serializedMaterials = [];
	this.logging = {
		enabled: true,
		debug: false
	};
}

MeshSpray.Parser.prototype = {

	constructor: MeshSpray.Parser,

	setLogging: function ( enabled, debug ) {
		this.logging.enabled = enabled === true;
		this.logging.debug = debug === true;
	},

	setCallbackDataReceiver: function ( callbackDataReceiver ) {
		this.callbackDataReceiver = callbackDataReceiver;
	},

	setSerializedMaterials: function ( serializedMaterials ) {
		if ( serializedMaterials !== undefined && serializedMaterials !== null ) this.serializedMaterials = serializedMaterials;
	},

	parse: function () {
		var baseTriangle = [ 1.0, 1.0, 1.0, - 1.0, 1.0, 1.0, 0.0, - 1.0, 1.0 ];
		var vertices = [];
		var colors = [];
		var normals = [];
		var uvs = [];

		var dimensionHalf = this.dimension / 2;
		var fixedOffsetX;
		var fixedOffsetY;
		var fixedOffsetZ;
		var s, t;
		// complete triangle
		var sizeVaring = this.sizeFactor * Math.random();
		// local coords offset
		var localOffsetFactor = this.localOffsetFactor;

		for ( var i = 0; i < this.quantity; i ++ ) {
			sizeVaring = this.sizeFactor * Math.random();

			s = 2 * Math.PI * Math.random();
			t = Math.PI * Math.random();

			fixedOffsetX = dimensionHalf * Math.random() * Math.cos( s ) * Math.sin( t );
			fixedOffsetY = dimensionHalf * Math.random() * Math.sin( s ) * Math.sin( t );
			fixedOffsetZ = dimensionHalf * Math.random() * Math.cos( t );
			for ( var j = 0; j < baseTriangle.length; j += 3 ) {
				vertices.push( baseTriangle[ j ] * sizeVaring + localOffsetFactor * Math.random() + fixedOffsetX );
				vertices.push( baseTriangle[ j + 1 ] * sizeVaring + localOffsetFactor * Math.random() + fixedOffsetY );
				vertices.push( baseTriangle[ j + 2 ] * sizeVaring + localOffsetFactor * Math.random() + fixedOffsetZ );
				colors.push( Math.random() );
				colors.push( Math.random() );
				colors.push( Math.random() );
			}
		}

		var absoluteVertexCount = vertices.length;
		var absoluteColorCount = colors.length;
		var absoluteNormalCount = 0;
		var absoluteUvCount = 0;

		var vertexFA = new Float32Array( absoluteVertexCount );
		var colorFA = (absoluteColorCount > 0) ? new Float32Array( absoluteColorCount ) : null;
		var normalFA = (absoluteNormalCount > 0) ? new Float32Array( absoluteNormalCount ) : null;
		var uvFA = (absoluteUvCount > 0) ? new Float32Array( absoluteUvCount ) : null;

		vertexFA.set( vertices, 0 );
		if ( colorFA ) {

			colorFA.set( colors, 0 );

		}

		if ( normalFA ) {

			normalFA.set( normals, 0 );

		}
		if ( uvFA ) {

			uvFA.set( uvs, 0 );

		}

		/*
		 * This demonstrates the usage of embedded three.js in the worker blob and
		 * the serialization of materials back to the Builder outside the worker.
		 *
		 * This is not the most effective way, but outlining possibilities
		 */
		var materialName = 'defaultVertexColorMaterial_double';
		var defaultVertexColorMaterialJson = this.serializedMaterials[ 'defaultVertexColorMaterial' ];
		var loader = new THREE.MaterialLoader();

		var defaultVertexColorMaterialDouble = loader.parse( defaultVertexColorMaterialJson );
		defaultVertexColorMaterialDouble.name = materialName;
		defaultVertexColorMaterialDouble.side = THREE.DoubleSide;

		var newSerializedMaterials = {};
		newSerializedMaterials[ materialName ] = defaultVertexColorMaterialDouble.toJSON();
		var payload = {
			cmd: 'data',
			type: 'material',
			materials: {
				serializedMaterials: newSerializedMaterials
			}
		};
		this.callbackDataReceiver( payload );

		this.globalObjectCount ++;
		this.callbackDataReceiver(
			{
				cmd: 'data',
				type: 'mesh',
				progress: {
					numericalValue: 1.0
				},
				params: {
					meshName: 'Gen' + this.globalObjectCount
				},
				materials: {
					multiMaterial: false,
					materialNames: [ materialName ],
					materialGroups: []
				},
				buffers: {
					vertices: vertexFA,
					colors: colorFA,
					normals: normalFA,
					uvs: uvFA
				}
			},
			[ vertexFA.buffer ],
			colorFA !== null ? [ colorFA.buffer ] : null,
			normalFA !== null ? [ normalFA.buffer ] : null,
			uvFA !== null ? [ uvFA.buffer ] : null
		);

		if ( this.logging.enabled ) console.info( 'Global output object count: ' + this.globalObjectCount );

		return this.baseObject3d;
	}
};

var MeshSprayApp = function ( elementToBindTo ) {
	this.renderer = null;
	this.canvas = elementToBindTo;
	this.aspectRatio = 1;
	this.recalcAspectRatio();

	this.scene = null;
	this.cameraDefaults = {
		posCamera: new THREE.Vector3( 500.0, 500.0, 1000.0 ),
		posCameraTarget: new THREE.Vector3( 0, 0, 0 ),
		near: 0.1,
		far: 10000,
		fov: 45
	};
	this.camera = null;
	this.cameraTarget = this.cameraDefaults.posCameraTarget;

	this.controls = null;

	this.cube = null;
	this.pivot = null;
}


MeshSprayApp.prototype = {

	constructor: MeshSprayApp,

	initGL: function () {
		this.renderer = new THREE.WebGLRenderer( {
			canvas: this.canvas,
			antialias: true,
			autoClear: true
		} );
		this.renderer.setClearColor( 0x050505 );

		this.scene = new THREE.Scene();

		this.camera = new THREE.PerspectiveCamera( this.cameraDefaults.fov, this.aspectRatio, this.cameraDefaults.near, this.cameraDefaults.far );
		this.resetCamera();
		this.controls = new THREE.TrackballControls( this.camera, this.renderer.domElement );

		var ambientLight = new THREE.AmbientLight( 0x404040 );
		var directionalLight1 = new THREE.DirectionalLight( 0xC0C090 );
		var directionalLight2 = new THREE.DirectionalLight( 0xC0C090 );

		directionalLight1.position.set( - 100, - 50, 100 );
		directionalLight2.position.set( 100, 50, - 100 );

		this.scene.add( directionalLight1 );
		this.scene.add( directionalLight2 );
		this.scene.add( ambientLight );

		var helper = new THREE.GridHelper( 1200, 60, 0xFF4444, 0x404040 );
		this.scene.add( helper );

		var geometry = new THREE.BoxBufferGeometry( 10, 10, 10 );
		var material = new THREE.MeshNormalMaterial();
		this.cube = new THREE.Mesh( geometry, material );
		this.cube.position.set( 0, 0, 0 );
		this.scene.add( this.cube );

		this.pivot = new THREE.Object3D();
		this.pivot.name = 'Pivot';
		this.scene.add( this.pivot );
	},

	initContent: function () {
		var maxQueueSize = 1024;
		var maxWebWorkers = 4;
		var radius = 640;
		var workerLoaderDirector = new THREE.WorkerLoader.Director().setLogging( false, false ).setCrossOrigin( 'anonymous' );

		var callbackOnLoad = function ( event ) {
			console.info( 'Worker #' + event.detail.instanceNo + ': Completed loading. (#' + workerLoaderDirector.objectsCompleted + ')' );
		};
		var callbackOnReport = function ( event ) {
			document.getElementById( 'feedback' ).innerHTML = event.detail.text;
			console.info( event.detail.text );
		};
		var callbackOnMesh = function ( event ) {
			var override = new THREE.MeshTransfer.LoadedMeshUserOverride( false, true );

			event.detail.side = THREE.DoubleSide;
			var mesh = new THREE.Mesh( event.detail.bufferGeometry, event.detail.material );
			mesh.name = event.detail.meshName;
			override.addMesh( mesh );

			return override;
		};

		workerLoaderDirector.createWorkerPool( 'meshspray', maxQueueSize );
		workerLoaderDirector.updateWorkerPool( 'meshspray', maxWebWorkers );
		var pivot;
		var s, t, r, x, y, z;
		var globalObjectCount = 0;
		for ( var i = 0; i < maxQueueSize; i ++ ) {

			pivot = new THREE.Object3D();
			s = 2 * Math.PI * Math.random();
			t = Math.PI * Math.random();
			r = radius * Math.random();
			x = r * Math.cos( s ) * Math.sin( t );
			y = r * Math.sin( s ) * Math.sin( t );
			z = r * Math.cos( t );
			pivot.position.set( x, y, z );
			this.scene.add( pivot );

			var rdMeshSpray = new THREE.WorkerLoader.ResourceDescriptor( 'Metadata', 'Triangles_' + i );
			var parserConfiguration = {
				quantity: 8192,
				dimension: Math.max( Math.random() * 500, 100 ),
				globalObjectCount: globalObjectCount ++
			};
			rdMeshSpray.setParserConfiguration( parserConfiguration );
			var loadingTaskConfig = new THREE.WorkerLoader.LoadingTaskConfig( {
				baseObject3d: pivot,
				sendMaterials: true,
				sendMaterialsJson: true
			} )
				.setLoaderConfig( MeshSpray.Loader )
				.setExtension( 'meshspray' )
				.addResourceDescriptor( rdMeshSpray )
				.setCallbacksApp( callbackOnReport )
				.setCallbacksParsing( callbackOnMesh )
				.setCallbacksPipeline( callbackOnLoad );

			workerLoaderDirector.enqueueForRun( loadingTaskConfig );
		}
		workerLoaderDirector.processQueue();
	},

	resizeDisplayGL: function () {
		this.controls.handleResize();

		this.recalcAspectRatio();
		this.renderer.setSize( this.canvas.offsetWidth, this.canvas.offsetHeight, false );

		this.updateCamera();
	},

	recalcAspectRatio: function () {
		this.aspectRatio = (this.canvas.offsetHeight === 0) ? 1 : this.canvas.offsetWidth / this.canvas.offsetHeight;
	},

	resetCamera: function () {
		this.camera.position.copy( this.cameraDefaults.posCamera );
		this.cameraTarget.copy( this.cameraDefaults.posCameraTarget );

		this.updateCamera();
	},

	updateCamera: function () {
		this.camera.aspect = this.aspectRatio;
		this.camera.lookAt( this.cameraTarget );
		this.camera.updateProjectionMatrix();
	},

	render: function () {
		if ( ! this.renderer.autoClear ) this.renderer.clear();

		this.controls.update();

		this.cube.rotation.x += 0.05;
		this.cube.rotation.y += 0.05;

		this.renderer.render( this.scene, this.camera );
	}
};
