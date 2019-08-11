function playSound() {

    var audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create nodes
    var oscNode = audioContext.createOscillator();
    oscNode.start();

    var vcaNode = audioContext.createGain();

    // Connect up node graph
    oscNode.connect(vcaNode);
    vcaNode.connect(audioContext.destination);

    // Instantiate envelope generator, leaving some settings as defaults
    var eg = new EnvGen(audioContext, vcaNode.gain);
    eg.mode = 'ASR';
    eg.attackTime = 0.01;
    eg.releaseTime = 0.02;

    // Every second, schedule a gate cycle a little bit in the future
    setInterval(function() {
        var t = audioContext.currentTime;
        eg.gateOn(t + 0.1);
        eg.gateOff(t + 0.4);
    }, 1000);
}

let playButton = document.getElementById("play-button");
playButton.onclick = playSound;
