import * as THREE from 'three';
import { clamp, dot, vec3, Fn, cross, float, If, arrayBuffer, array, bool, Loop, Continue, uint, select, sqrt } from 'three/tsl';

const BVH_STACK_DEPTH = 60;

const distanceSqToBounds = Fn( ( [ point, boundsMin, boundsMax ] ) => {

	const clampedPoint = clamp( point, boundsMin, boundsMax );
	const delta = point.sub( clampedPoint );
	return dot( delta, delta );

} ).setLayout( {
	name: 'distanceSqToBounds',
	type: 'float',
	inputs: [
		{ name: 'point', type: 'vec3' },
		{ name: 'boundsMin', type: 'vec3' },
		{ name: 'boundsMax', type: 'vec3' }
	]
} );

const distanceSqToBVHNodeBoundsPoint = ( point, bvhStorage, currNodeIndex ) => {

	const cni2 = currNodeIndex.mul( 2 );
	const boundsMin = bvhStorage.element( cni2 ).bounds.xyz;
	const boundsMax = bvhBoundsStorage.element( cni2 + 1 ).bounds.xyz;
	return distanceSqToBounds( point, boundsMin, boundsMax );

};

const closestPointToTriangle = Fn( ( [ p, v0, v1, v2 ] ) => {

	const v10 = v1.sub( v0 );
	const v21 = v2.sub( v1 );
	const v02 = v0.sub( v2 );

	const p0 = p.sub( v0 );
	const p1 = p.sub( v1 );
	const p2 = p.sub( v2 );

	const nor = cross( v10, v02 );

	// method 2, in barycentric space
	const q = cross( nor, p0 );
	const d = float( 1.0 ).div( dot( nor, nor ) );
	const u = d.mul( dot( q, v02 ) ).toVar( 'u' );
	const v = d.mul( dot( q, v10 ) ).toVar( 'v' );
	const w = float( 1.0 ).sub( u ).sub( v ).toVar( 'w' );


	If( u.lessThan( 0.0 ), () => {

		w.assign(
			clamp( dot( p2, v02 ) / dot( v02, v02 ), 0.0, 1.0 )
		);
		u.assign( 0.0 );
		v.assign( float( 1.0 ).sub( w ) );

	} ).ElseIf( v.lessThan( 0.0 ), () => {

		u.assign( clamp( dot( p0, v10 ) / dot( v10, v10 ), 0.0, 1.0 ) );
		v.assign( 0.0 );
		w.assign( float( 1.0 ).sub( u ) );

	} ).ElseIf( w.lessThan( 0.0 ), () => {

		v.assign( clamp( dot( p1, v21 ) / dot( v21, v21 ), 0.0, 1.0 ) );
		w.assign( 0.0 );
		u.assign( float( 1.0 ).sub( v ) );

	} );


	// barycoord = vec3( u, v, w );

	return ( u.mul( v1 ) ).add( v.mul( v2 ) ).add( w.mul( v0 ) );

} ).setLayout( {
	name: 'closestPointToTriangle',
	type: 'vec3',
	inputs: [ {
		name: 'p', type: 'vec3',
		name: 'v0', type: 'vec3',
		name: 'v1', type: 'vec3',
		name: 'v2', type: 'vec3'
	} ]
} );

const bvhClosestPointToPoint = (
	bvhStorage,
	point,
	maxDistance,
	faceIndices,
	faceNormal,
	barycoord,
	side,
	outPoint
) => {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	const ptr = uint( 0 ).toVar();
	const stack = array( 'uint', BVH_STACK_DEPTH );
	stack.element( 0 ).assign( uint( 0 ) );

	const closestDistanceSquared = maxDistance.mul( maxDistance );

	Loop( ptr.greaterThan( - 1 ).and( ptr.lessThan( BVH_STACK_DEPTH ) ), () => {

		const currNodeIndex = stack.element( ptr );
		ptr.assign( ptr.sub( 1 ) );

		const boundsHitDistance = distanceSqToBVHNodeBoundsPoint( point, bvhStorage, currNodeIndex );

		If( boundsHitDistance.greaterThan( closestDistanceSquared ), () => {

			Continue();

		} );

		const boundsInfo = bvhStorage.element( currNodeIndex ).contents.xy;
		const isLeaf = bool( boundsInfo.x.bitAnd( 0xffff0000 ) );

		If( isLeaf, () => {

			const count = boundsInfo.x.bitAnd( 0xffff0000 );
			const offset = boundsInfo.y;
			closestDistanceSquared(
				distanceToTriangles(
					bvhStorage,
					offset,
					count,
					point,
					closestDistanceSquared,
					faceIndices,
					faceNormal,
					barycoord,
					side,
					outPoint
				)
			);

		} ).Else( () => {


			const leftIndex = currNodeIndex.add( 1 );
			const rightIndex = boundsInfo.y;
			const leftToRight = distanceSqToBVHNodeBoundsPoint( point, bvhStorage, leftIndex ).lessThan( distanceSqToBVHNodeBoundsPoint( point, bvhStorage, rightIndex ) );//rayDirection[ splitAxis ] >= 0.0;
			const c1 = select( leftToRight, leftIndex, rightIndex ).toVar( 'c1' );
			const c2 = select( leftToRight, rightIndex, leftIndex ).toVar( 'c2' );

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			ptr.assign( ptr.add( 1 ) );
			stack.element( ptr ).assign( c2 );
			ptr.assign( ptr.add( 1 ) );
			stack.element( ptr ).assign( c1 );

		} );



	} );

	return sqrt( closestDistanceSquared );

};


