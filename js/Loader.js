/**
 * Created with JetBrains WebStorm.
 * User: mauricio
 * Date: 7/31/13
 * Time: 1:59 PM
 * To change this template use File | Settings | File Templates.
 */
var Loader = function (callback) {

    function load(index) {
        if (index < Loader.list.length) {
            var script = document.createElement('script');
            script.onload = function () {
                load(index + 1);
            };
            script.src = Loader.list[index];
            document
                .getElementsByTagName('head')[0]
                .appendChild(script);
        } else {
            callback();
        }
    }

    load(0);
};

Loader.list = [
    // T3
    'T3/lib/dat.gui.min.js',
    'T3/lib/stats.min.js',
    'T3/lib/jquery-1.9.1.js',
    'T3/lib/Extend.js',
    'T3/lib/three.59.min.js',
    'T3/lib/Detector.js',
    'T3/lib/Coordinates.js',
    'T3/lib/THREEx.FullScreen.js',
    'T3/lib/THREEx.WindowResize.js',
    'T3/lib/OrbitAndPanControls.js',
    'T3/js/T3.js',
    'T3/js/Application.js',
    'T3/js/ObjectManager.js',
    'T3/js/controller/World.js',
    'T3/js/model/Coordinates.js',

    // APE
    'js/Core.js',
    'js/Constants.js',
    'js/Particle.js',
    'js/ParticleFactory.js',
    'js/ParticleForceRegistry.js',
    'js/ParticleForceGenerator.js',
    'js/ParticleDrag.js',
    'js/ParticleGravity.js'
];