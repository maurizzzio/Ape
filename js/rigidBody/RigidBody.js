/**
 * Created with JetBrains WebStorm.
 * User: mauricio
 * Date: 7/29/13
 * Time: 10:07 PM
 * To change this template use File | Settings | File Templates.
 */

(function () {
    var RigidBody;

    RigidBody = function () {
        THREE.Mesh.apply(this, arguments);
        // ************** DATA AND STATE **************
        /**
         * Inverse of the mass:
         * f = m * a (force equals mass times acceleration)
         * a = (1 / m) * f (1 / m is the inverse of the mass)
         *
         * This means that infinite mass object have a zero inverse mass since 1 / ∞ = 0
         * Objects of zero mass have an undefined inverse mass
         * @type {*}
         */
        this.inverseMass = 1.0;
        /**
         * Holds the inverse of the body's inertia tensor given in BODY space
         * @type {Ape.Matrix3}
         */
        this.inverseInertiaTensor = new Ape.Matrix3();
        /**
         * Holds the amount of damping applied to linear
         * motion. Damping is required to remove energy added
         * through numerical instability in the integrator.
         * @type {number}
         */
        this.linearDamping = 0.9;
        /**
         * Holds the amount of damping applied to angular
         * motion. Damping is required to remove energy added
         * through numerical instability in the integrator.
         * @type {number}
         */
        this.angularDamping = 0.9;
        /**
         * Holds the linear position of the rigid body in
         * world space.
         */
        this.position = this.position || new THREE.Vector3();
        /**
         * Holds the angular orientation of the rigid body in WORLD space
         * @type {Ape.Quaternion}
         */
        this.orientation = new Ape.Quaternion();
        /**
         * Holds the linear velocity of the rigid body in
         * world space.
         */
        this.linearVelocity = new THREE.Vector3();
        /**
         * Holds the angular velocity or rotation of the rigid body in world space
         * @type {THREE.Vector3}
         */
        this.angularVelocity = new THREE.Vector3();

        // ************** DERIVED DATA **************
        // information that's derived from the other data in the class
        /**
         * Holds the inverse of the body's inertia tensor in WORLD coordinates
         * (it's calculated each frame in `calculateDerivedData`
         * @type {Ape.Matrix3}
         */
        this.inverseInertiaTensorWorld = new Ape.Matrix3();
        /**
         * Holds a transform matrix for converting body space
         * into world space and vice versa. This can be achieved by calling the
         * getPointInSpace functions.
         */
        this.transformMatrix = new Ape.Matrix4();

        // ************** FORCE AND TORQUE ACCUMULATORS **************
        // store the current force, torque and acceleration of the rigid body
        /**
         * Holds the accumulated force to be applied at the next
         * simulation iteration only. This value is zeroed at each integration step.
         */
        this.accumulatedForce = new THREE.Vector3();
        /**
         * Holds the accumulated torque to be applied at the next
         * simulation iteration only. This value is zeroed at each integration step.
         */
        this.accumulatedTorque = new THREE.Vector3();
        /**
         * Holds the acceleration of the rigid body, can be used to set
         * acceleration due to gravity or any other CONSTANT acceleration
         * @type {THREE.Vector3}
         */
        this.acceleration = new THREE.Vector3();
    };

    RigidBody.prototype = new THREE.Mesh();

    $.extend(RigidBody.prototype, {
        setMass: function (m) {
            Ape.assert(m !== 0);
            this.inverseMass = 1 / m;
        },

        setInverseMass: function (m) {
            this.inverseMass = m;
        },

        getMass: function () {
            if (this.inverseMass < 1e-9) {
                return Infinity;
            }
            return 1 / this.inverseMass;
        },

        getInverseMass: function () {
            return this.inverseMass;
        },

        /**
         * Integrates the rigid body forward in time by `delta` ms
         * @param {number} delta
         */
        integrate: function (delta) {
            Ape.assert(delta > 0);

            // calculate linear acceleration from force inputs
            // a' = old_a + a
            // let:
            //      f = m * a
            //      a = f * (1 / m)
            // so:
            // a' = old_a + f * m^(-1)
            var linearAcceleration =
                this.acceleration.clone()
                    .add(
                        this.accumulatedForce.clone()
                            .multiplyScalar(this.inverseMass)
                    );

            // calculate angular acceleration from force inputs
            // let:
            //      O be the angular acceleration
            //      I be the moment of inertia
            //      r be the torque vector
            // r = I * O
            // O = I^(-1) * r
            var angularAcceleration =
                this.inverseInertiaTensorWorld.transform(
                    this.accumulatedTorque
                );

            // PHASE 1: Velocities adjustment
            // linear velocity update
            // v' = v + linear_acceleration * delta
            this.linearVelocity
                .add(
                    linearAcceleration
                        .multiplyScalar(delta)
                );
            // angular velocity update
            // let:
            //      w be the angular velocity of the rigid body
            // w' = w + angular_acceleration * delta
            this.angularVelocity
                .add(
                    angularAcceleration
                        .multiplyScalar(delta)
                );

            // impose drag
            this.linearVelocity
                .multiplyScalar(
                    Math.pow(this.linearDamping, delta)
                );
            this.angularVelocity
                .multiplyScalar(
                    Math.pow(this.angularDamping, delta)
                );

            // PHASE 2: Position adjustment
            // linear position update
            // position' = position + v * t + 0.5 * a * t * t
            this.position
                .add(
                    this.linearVelocity.clone()
                        .multiplyScalar(delta)
                )
                // since delta squared times 0.5 gives a really small number,
                // the acceleration is commonly ignored
                .add(
                    this.acceleration.clone()
                        .multiplyScalar(delta * delta * 0.5)
                );

            // angular position (orientation) update
            // let:
            //      p be the angular displacement
            //      w be the angular velocity
            //      alpha be the angular acceleration
            // p' = p + w * t + 0.5 * a * t * t
            // since 0.5 * a * t * t gives a really small number it's commonly ignored
            // so
            // p' = p + w * t
            this.orientation
                .addScaledVector(this.angularVelocity, delta);

            // TEST IN THREE JS:
            // the rotation of an object uses euler angles, since we have
            // a quaternion we have to update the rotation converting
            // the quaternion to euler angles
            this.rotation.setFromQuaternion(
                this.orientation,
                THREE.Euler.DefaultOrder
            );

            // normalize the orientation, update the transformMatrix and
            // inverseInertiaTensor matrices to reflect the new changes
            // to the position and orientation of the body
            this.calculateDerivedData();

            // clears the forces and torque accumulated in the last frame
            this.clearAccumulators();
        },

        /**
         * Updates the information of the body like its transform matrix and
         * its inverse inertial tensor
         */
        calculateDerivedData: function () {
            // the orientation might have suffered some changes during the
            // application of the rotation, let's make sure it's length
            // is 1 so that it represents a correct orientation
            this.orientation.normalize();

            // update the transform matrix
            this.calculateTransformMatrix(
                this.transformMatrix, this.position, this.orientation
            );

            // calculate the inertialTensor in world space
            this.transformInertiaTensor(
                this.inverseInertiaTensorWorld,
                this.orientation,
                this.inverseInertiaTensor,
                this.transformMatrix
            );
        },

        /**
         * Clears the forces applied to the rigid body.
         * This will be called automatically after each integration step.
         */
        clearAccumulators: function () {
            this.accumulatedForce.set(0, 0, 0);
            this.accumulatedTorque.set(0, 0, 0);
        },

        /**
         * Adds the given force to the center of mass of the rigid body,
         * the force is expressed in world coordinates
         * @param f
         */
        addForce: function (f) {
            this.accumulatedForce
                .add(f);
        },

        /**
         * Adds the given torque to the center of mass of the rigid body,
         * the force is expressed in world coordinates
         * @param r
         */
        addTorque: function (r) {
            this.accumulatedTorque
                .add(r);
        },

        /**
         * Adds a `force` in a specific `point`, the point is specified in
         * WORLD coordinates
         * @param {THREE.Vector3} f
         * @param {THREE.Vector3} point
         */
        addForceAtPoint: function (f, point) {
            // vector from the center of mass to the point
            var pt = point.clone().sub(this.position);
            this.accumulatedForce
                .add(f);
            this.accumulatedTorque
                .add(pt.cross(f));
        },

        /**
         * Adds the given force to the given point on the rigid body, the direction
         * of the point is given in world space coordinates but the application point
         * is given in object space coordinates
         * @param {THREE.Vector3} force
         * @param {THREE.Vector3} point
         */
        addForceAtBodyPoint: function (force, point) {
            var pt = this.getPointInWorldSpace(point);
            this.addForceAtPoint(force, pt);
        },

        /**
         * Sets the inertia tensor of this rigid body (internally the inverseInertiaTensor
         * is set to make easier calculations)
         * @param {Ape.Matrix3} inertiaTensor
         */
        setInertiaTensor: function (inertiaTensor) {
            this.inverseInertiaTensor.setInverse(inertiaTensor);
            this.checkInverseInertiaTensor(this.inverseInertiaTensor);
        },

        /**
         * @private
         * Each frame the transformation matrix (Matrix4) must be updated,
         * it's updated using a vector3 which represents the position
         * and a quaternion which represents the orientation
         * @param {Ape.Matrix4} transformMatrix
         * @param {THREE.Vector3} position
         * @param {Ape.Quaternion} q
         */
        calculateTransformMatrix: function (transformMatrix, position, q) {
            transformMatrix.set(
                1 - 2 * (q.y * q.y + q.z * q.z),
                2 * (q.x * q.y - q.z * q.w),
                2 * (q.x * q.z + q.y * q.w),
                position.x,

                2 * (q.x * q.y + q.z * q.w),
                1 - 2 * (q.x * q.x + q.z * q.z),
                2 * (q.y * q.z - q.x * q.w),
                position.y,

                2 * (q.x * q.z - q.y * q.w),
                2 * (q.y * q.z + q.x * q.w),
                1 - 2 * (q.x * q.x + q.y * q.y),
                position.z
            );
        },

        /**
         * @private
         * Transforms the inverse inertia tensor from object coordinates to world
         * coordinates (called in `calculateDerivedData`)
         * @param iitWorld  inverse inertia tensor world
         * @param q         orientation
         * @param iitBody   inverse inertia tensor
         * @param tm        Transformation matrix
         */
        transformInertiaTensor: function (iitWorld, q, iitBody, tm) {
            var t4 = tm.data[0] * iitBody.data[0]+
                tm.data[1] * iitBody.data[3]+
                tm.data[2] * iitBody.data[6];
            var t9 = tm.data[0] * iitBody.data[1]+
                tm.data[1] * iitBody.data[4]+
                tm.data[2] * iitBody.data[7];
            var t14 = tm.data[0] * iitBody.data[2]+
                tm.data[1] * iitBody.data[5]+
                tm.data[2] * iitBody.data[8];
            var t28 = tm.data[4] * iitBody.data[0]+
                tm.data[5] * iitBody.data[3]+
                tm.data[6] * iitBody.data[6];
            var t33 = tm.data[4] * iitBody.data[1]+
                tm.data[5] * iitBody.data[4]+
                tm.data[6] * iitBody.data[7];
            var t38 = tm.data[4] * iitBody.data[2]+
                tm.data[5] * iitBody.data[5]+
                tm.data[6] * iitBody.data[8];
            var t52 = tm.data[8] * iitBody.data[0]+
                tm.data[9] * iitBody.data[3]+
                tm.data[10] * iitBody.data[6];
            var t57 = tm.data[8] * iitBody.data[1]+
                tm.data[9] * iitBody.data[4]+
                tm.data[10] * iitBody.data[7];
            var t62 = tm.data[8] * iitBody.data[2]+
                tm.data[9] * iitBody.data[5]+
                tm.data[10] * iitBody.data[8];

            iitWorld.data[0] = t4 * tm.data[0]+
                t9 * tm.data[1]+
                t14 * tm.data[2];
            iitWorld.data[1] = t4 * tm.data[4]+
                t9 * tm.data[5]+
                t14 * tm.data[6];
            iitWorld.data[2] = t4 * tm.data[8]+
                t9 * tm.data[9]+
                t14 * tm.data[10];
            iitWorld.data[3] = t28 * tm.data[0]+
                t33 * tm.data[1]+
                t38 * tm.data[2];
            iitWorld.data[4] = t28 * tm.data[4]+
                t33 * tm.data[5]+
                t38 * tm.data[6];
            iitWorld.data[5] = t28 * tm.data[8]+
                t33 * tm.data[9]+
                t38 * tm.data[10];
            iitWorld.data[6] = t52 * tm.data[0]+
                t57 * tm.data[1]+
                t62 * tm.data[2];
            iitWorld.data[7] = t52 * tm.data[4]+
                t57 * tm.data[5]+
                t62 * tm.data[6];
            iitWorld.data[8] = t52 * tm.data[8]+
                t57 * tm.data[9]+
                t62 * tm.data[10];
        },

        /**
         * @private
         * Checks the validity of the new inertia tensor
         * @param {Ape.Matrix3} iitWorld
         */
        checkInverseInertiaTensor: function (iitWorld) {
//            if (iitWorld) {
//                console.warn("Inverse inertia tensor is be invalid");
//            }
        },

        /**
         * Transform a point given in OBJECT coordinates to
         * WORLD coordinates (NOTE: make sure to understand
         * that the normal basis of this object might have changed
         * and may not be aligned with the world's normal basis)
         * @param {THREE.Vector3} point
         * @returns {THREE.Vector3}
         */
        getPointInWorldSpace: function (point) {
            return this.transformMatrix.transform(point);
        },

        /**
         * Transforms a point given in WORLD coordinates to
         * OBJECT coordinates (NOTE: make sure to understand
         * that the normal basis of this object might have changed
         * and may not be aligned with the world's normal basis)
         * @param {THREE.Vector3} point
         * @returns {THREE.Vector3}
         */
        getPointInLocalSpace: function (point) {
            return this.transformMatrix.transformInverse(point);
        },

        /**
         * Sets the value for both the linear damping and the angular damping
         * @param {number} linearDamping
         * @param {number} angularDamping
         */
        setDamping: function (linearDamping, angularDamping) {
            this.linearDamping = linearDamping;
            this.angularDamping = angularDamping;
        }

    });

    Ape.RigidBody = RigidBody;
})();