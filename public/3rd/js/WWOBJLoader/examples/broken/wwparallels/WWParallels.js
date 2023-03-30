/**
 * @author Kai Salmen / www.kaisalmen.de
 */

'use strict';

var WWParallels = function ( elementToBindTo ) {
	this.renderer = null;
	this.canvas = elementToBindTo;
	this.aspectRatio = 1;
	this.recalcAspectRatio();

	this.scene = null;
	this.cameraDefaults = {
		posCamera: new THREE.Vector3( 0.0, 175.0, 500.0 ),
		posCameraTarget: new THREE.Vector3( 0, 0, 0 ),
		near: 0.1,
		far: 10000,
		fov: 45
	};
	this.camera = null;
	this.cameraTarget = this.cameraDefaults.posCameraTarget;

	this.logging = {
		enabled: false,
		debug: false
	};
	this.controls = null;
	this.cube = null;

	this.allAssets = [];
	this.feedbackArray = null;

	this.running = false;
};

WWParallels.prototype = {

	constructor: WWParallels,

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

		var geometry = new THREE.BoxBufferGeometry( 10, 10, 10 );
		var material = new THREE.MeshNormalMaterial();
		this.cube = new THREE.Mesh( geometry, material );
		this.cube.position.set( 0, 0, 0 );
		this.scene.add( this.cube );
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
	},

	_reportProgress: function ( content ) {
		var output = content;
		if ( THREE.MeshTransfer.Validator.isValid( content ) && THREE.MeshTransfer.Validator.isValid( content.detail ) ) output = content.detail.text;

		output = THREE.MeshTransfer.Validator.verifyInput( output, '' );
		if ( this.logging.enabled ) console.info( 'Progress:\n\t' + output.replace( /\<br\>/g, '\n\t' ) );
		document.getElementById( 'feedback' ).innerHTML = output;
	},

	enqueueAllAssests: function ( maxQueueSize, maxWebWorkers, enforceSync ) {
		var scope = this;
		if ( this.running ) {

			return;

		} else {

			var scopedOnReportError = function ( supportDesc, errorMessage ) {

				console.error( 'workerLoaderDirector reported an error: ' );
				console.error( errorMessage );
				return true;

			};
			this.workerLoaderDirector = new THREE.WorkerLoader.Director()
				.setLogging( this.logging.enabled, this.logging.debug )
				.setCrossOrigin( 'anonymous' )
				.setForceWorkerDataCopy( true )
				.setGlobalAppCallbacks( null, scopedOnReportError, null );
			this.running = true;

		}
		scope.workerLoaderDirector.objectsCompleted = 0;
		scope.feedbackArray = [];
		scope.reportDonwload = [];

		var i;
		for ( i = 0; i < maxWebWorkers; i ++ ) {

			scope.feedbackArray[ i ] = 'Worker #' + i + ': Awaiting feedback';
			scope.reportDonwload[ i ] = true;

		}
		scope._reportProgress( scope.feedbackArray.join( '\<br\>' ) );

		var callbackOnComplete = function ( event ) {
			var instanceNo = event.detail.instanceNo;
			scope.reportDonwload[ instanceNo ] = false;
			scope.allAssets.push( event.detail.result );

			var msg = 'Worker #' + instanceNo + ': Completed loading: ' + event.detail.modelName + ' (#' + scope.workerLoaderDirector.objectsCompleted + ')';
			if ( scope.logging.enabled ) console.info( msg );
			scope.feedbackArray[ instanceNo ] = msg;
			scope._reportProgress( scope.feedbackArray.join( '\<br\>' ) );

			if ( scope.workerLoaderDirector.objectsCompleted + 1 === maxQueueSize ) scope.running = false;
		};

		var callbackOnReport = function ( event ) {
			var instanceNo = event.detail.instanceNo;
			var text = event.detail.text;

			if ( scope.reportDonwload[ instanceNo ] ) {
				var msg = 'Worker #' + instanceNo + ': ' + text;
				if ( scope.logging.enabled ) console.info( msg );

				scope.feedbackArray[ instanceNo ] = msg;
				scope._reportProgress( scope.feedbackArray.join( '\<br\>' ) );
			}
		};

		var callbackOnMesh = function ( event, override ) {
			if ( ! THREE.MeshTransfer.Validator.isValid( override ) ) override = new THREE.MeshTransfer.LoadedMeshUserOverride( false, false );

			var material = event.detail.material;
			var meshName = event.detail.meshName;
			if ( THREE.MeshTransfer.Validator.isValid( material ) && material.name === 'defaultMaterial' || meshName === 'Mesh_Mesh_head_geo.001_lambert2SG.001' ) {

				var materialOverride = material;
				materialOverride.color = new THREE.Color( Math.random(), Math.random(), Math.random() );
				var mesh = new THREE.Mesh( event.detail.bufferGeometry, material );
				mesh.name = meshName;

				override.addMesh( mesh );
				override.alteredMesh = true;

			}
			return override;
		};

		var callbackOnMaterials = function ( materials ) {
			console.log( 'Materials loaded' );
			return materials;
		};

		if ( this.logging.enabled ) console.info( 'Configuring WWManager with queue size ' + this.workerLoaderDirector.getMaxQueueSize() + ' and ' + this.workerLoaderDirector.getMaxWebWorkers() + ' workers.' );

		var prepData, rdMtl;
		var prepDatas = [];
		prepData = {
			modelName: 'male02',
			scale: 1.0,
			resourceDescriptors: []
		};
		rdMtl = new THREE.WorkerLoader.ResourceDescriptor( 'URL', 'male02.mtl', '../../resource/obj/male02/male02.mtl' );
		rdMtl.configureAsync( false, false );
		var parserConfigurationMtl = {
			payloadType: 'text',
			haveMtl: true,
			resourcePath: '../../resource/obj/male02/',
			materialOptions: {}
		};
		var callbackOnProcessResult = function ( resourceDescriptor ) {
			console.log( resourceDescriptor.name + ' was loaded!' );
		};
		rdMtl.setParserConfiguration( parserConfigurationMtl )
			.setCallbackOnProcessResult( callbackOnProcessResult );
		prepData.resourceDescriptors.push( rdMtl );
		prepData.resourceDescriptors.push( new THREE.WorkerLoader.ResourceDescriptor( 'URL', 'male02.obj', '../../resource/obj/male02/male02.obj' ) );
		prepDatas.push( prepData );

		prepData = {
			modelName: 'female02',
			scale: 1.0,
			resourceDescriptors: []
		};
		rdMtl = new THREE.WorkerLoader.ResourceDescriptor( 'URL', 'female02.mtl', '../../resource/obj/female02/female02.mtl' );
		rdMtl.configureAsync( false, false );
		var parserConfigurationMtl = {
			payloadType: 'text',
			haveMtl: true,
			resourcePath: '../../resource/obj/female02/',
			materialOptions: {}
		};
		rdMtl.setParserConfiguration( parserConfigurationMtl );
		prepData.resourceDescriptors.push( rdMtl );
		prepData.resourceDescriptors.push( new THREE.WorkerLoader.ResourceDescriptor( 'URL', 'female02.obj', '../../resource/obj/female02/female02.obj' ) );
		prepDatas.push( prepData );

		prepData = {
			modelName: 'viveController',
			scale: 400.0,
			resourceDescriptors: []
		};
		prepData.resourceDescriptors.push( new THREE.WorkerLoader.ResourceDescriptor( 'URL', 'vr_controller_vive_1_5.obj', '../../resource/obj/vive-controller/vr_controller_vive_1_5.obj' ) );
		prepDatas.push( prepData );

		prepData = {
			modelName: 'cerberus',
			scale: 50.0,
			resourceDescriptors: []
		};
		prepData.resourceDescriptors.push( new THREE.WorkerLoader.ResourceDescriptor( 'URL', 'Cerberus.obj', '../../resource/obj/cerberus/Cerberus.obj' ) );
		prepDatas.push( prepData );

		prepData = {
			modelName: 'WaltHead',
			scale: 1.0,
			resourceDescriptors: []
		};
		rdMtl = new THREE.WorkerLoader.ResourceDescriptor( 'URL', 'WaltHead.mtl', '../../resource/obj/walt/WaltHead.mtl' );
		rdMtl.configureAsync( false, false );
		var parserConfigurationMtl = {
			payloadType: 'text',
			haveMtl: true,
			resourcePath: '../../resource/obj/walt/',
			materialOptions: {}
		};
		rdMtl.setParserConfiguration( parserConfigurationMtl );
		prepData.resourceDescriptors.push( rdMtl );
		prepData.resourceDescriptors.push( new THREE.WorkerLoader.ResourceDescriptor( 'URL', 'WaltHead.obj', '../../resource/obj/walt/WaltHead.obj' ) );
		prepDatas.push( prepData );

		var pivot;
		var distributionBase = - 500;
		var distributionMax = 1000;
		var modelPrepDataIndex = 0;
		var modelPrepData;

		this.workerLoaderDirector.createWorkerPool( 'obj', maxQueueSize );
		this.workerLoaderDirector.updateWorkerPool( 'obj', maxWebWorkers );
		for ( i = 0; i < maxQueueSize; i ++ ) {

			modelPrepDataIndex = Math.floor( Math.random() * prepDatas.length );
			modelPrepData = prepDatas[ modelPrepDataIndex ];

			pivot = new THREE.Object3D();
			pivot.position.set(
				distributionBase + distributionMax * Math.random(),
				distributionBase + distributionMax * Math.random(),
				distributionBase + distributionMax * Math.random()
			);
			pivot.scale.set( modelPrepData.scale, modelPrepData.scale, modelPrepData.scale );
			this.scene.add( pivot );

			var baseConfig = {
				baseObject3d: pivot,
				enforceSync: enforceSync === true
			};
			var loadingTaskConfig = new THREE.WorkerLoader.LoadingTaskConfig( baseConfig )
				.setLoaderConfig( THREE.OBJLoader2, { modelName: modelPrepData.modelName } )
				.setExtension( 'obj' )
				.setResourceDescriptors( modelPrepData.resourceDescriptors )
				.setCallbacksApp( callbackOnReport )
				.setCallbacksParsing( callbackOnMesh, callbackOnMaterials )
				.setCallbacksPipeline( callbackOnComplete );

			this.workerLoaderDirector.enqueueForRun( loadingTaskConfig );
		}
		this.workerLoaderDirector.processQueue();
	},

	updateWorkerPoolSize: function ( maxWebWorkers ) {
		if ( THREE.MeshTransfer.Validator.isValid( this.workerLoaderDirector ) ) this.workerLoaderDirector.updateWorkerPool( 'obj', maxWebWorkers );
	},

	clearAllAssests: function () {
		var storedObject3d;
		for ( var asset in this.allAssets ) {

			storedObject3d = this.allAssets[ asset ];
			var scope = this;
			var remover = function ( object3d ) {

				if ( storedObject3d === object3d ) return;

				if ( scope.logging.enabled ) console.info( 'Removing ' + object3d.name );
				scope.scene.remove( object3d );

				if ( object3d.hasOwnProperty( 'geometry' ) ) object3d.geometry.dispose();
				if ( object3d.hasOwnProperty( 'material' ) ) {

					var mat = object3d.material;
					if ( mat.hasOwnProperty( 'materials' ) ) {

						var materials = mat.materials;
						for ( var name in materials ) {

							if ( materials.hasOwnProperty( name ) ) materials[ name ].dispose();

						}
					}
				}
				if ( object3d.hasOwnProperty( 'texture' ) ) object3d.texture.dispose();
			};
			if ( THREE.MeshTransfer.Validator.isValid( storedObject3d ) ) {

				if ( this.pivot !== storedObject3d ) scope.scene.remove( storedObject3d );
				storedObject3d.traverse( remover );
				storedObject3d = null;

			}
		}
		this.allAssets = [];
	},

	terminateManager: function () {
		this.workerLoaderDirector.tearDown();
		this.running = false;
	},

	terminateManagerAndClearScene: function () {
		var scope = this;
		var scopedClearAllAssests = function () {
			scope.clearAllAssests();
		};
		if ( this.workerLoaderDirector.isRunning() ) {

			this.workerLoaderDirector.setGlobalAppCallbacks( null, null, scopedClearAllAssests );

		} else {

			scopedClearAllAssests();

		}
		this.terminateManager();
	}
};
