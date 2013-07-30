/**
 * Created with JetBrains WebStorm.
 * User: mauricio
 * Date: 7/29/13
 * Time: 10:07 PM
 * To change this template use File | Settings | File Templates.
 */
Ape.Particle = Class.extend({
    init: function () {
        /**
         * Holds the linear position of the particle in
         * world space.
         */
        this.position = new Ape.Vector3();
        /**
         * Holds the linear velocity of the particle in
         * world space.
         */
        this.velocity = new Ape.Vector3();
        /**
         * Holds the acceleration of the particle. This value
         * can be used to set acceleration due to gravity (its primary
         * use) or any other constant acceleration.
         */
        this.acceleration = new Ape.Vector3();
        /**
         * Holds the amount of damping applied to linear
         * motion. Damping is required to remove energy added
         * through numerical instability in the integrator.
         */
        this.damping = 1.0;
        /**
         * Inverse of the mass:
         * f = m * a (force equals mass times acceleration)
         * a = (1 / m) * f (1 / m is the inverse of the mass)
         *
         * This means that infinite mass object have a zero inverse mass since 1 / ∞ = 0
         * Objects of zero mass have an undefined inverse mass
         * @type {*}
         */
        this.inverseMass = 0.0;

        /**
         * Accumulated forces that affect this particle
         * @type {Ape.Vector3}
         */
        this.accumulatedForce = new Ape.Vector3();
    },

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

    setDamping: function (v) {
        this.damping = v;
    },

    integrate: function (delta) {
        Ape.assert(delta > 0);
        Ape.assert(this.inverseMass >= 0);

        // update linear position
        // PHASE 1: Position update
        this.position = this.position
            .addScaledVector(this.velocity, delta)
            // since delta squared times 0.5 gives a really small number,
            // the acceleration is commonly ignored
            .addScaledVector(this.acceleration, delta * delta * 0.5);

        // PHASE 2: Velocity update
        var resultingAcceleration =
            this.acceleration.addScaledVector(
                this.accumulatedForce, this.inverseMass
            );

        this.velocity = this.velocity
            // impose drag
            .multiplyScalar(
                Math.pow(this.damping, delta)
            )
            .addScaledVector(
                resultingAcceleration, delta
            );
    },

    clearAccumulator: function () {
        this.accumulatedForce.clear();
    },

    addForce: function (f) {
        this.accumulatedForce = this.accumulatedForce.add(f);
    }
});