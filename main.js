const BASE_FREQS = [
    55.0000, // A
    58.2705, // A#
    61.7354, // B
    65.4064, // C
    69.2957, // C#
    73.4162, // D
    77.7817, // D#
    82.4069, // E
    87.3071, // F
    92.4986, // F#
    97.9989, // G
    103.826, // G#
];

// Maximum note index is arbitrarily 70. Who cares.
const MAX_NOTE_INDEX = 70;

function noteFrequency(note_ix) {
    if (note_ix > MAX_NOTE_INDEX || note_ix < 0) {
        throw new Error("invalid note index (" + note_ix + ")");
    }
    const base_freq_ix = note_ix % BASE_FREQS.length;
    const num_octaves_above = Math.floor(note_ix / BASE_FREQS.length);
    return BASE_FREQS[base_freq_ix] * (1 << num_octaves_above);
}

let audioCtx = null;
let currentSound = {
    osc: null,
    gain: null,
    lfo: null,
    eg: null
}

function playSound() {
    if (audioCtx === null) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        currentSound.osc = audioCtx.createOscillator();
        currentSound.osc.type = 'triangle';
        currentSound.osc.frequency.setValueAtTime(
            noteFrequency(30), audioCtx.currentTime);
        currentSound.gain = audioCtx.createGain();
        currentSound.gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        currentSound.lfo = audioCtx.createOscillator();
        currentSound.lfo.type = 'sine';
        currentSound.lfo.frequency.value = 120;
        currentSound.lfo.connect(currentSound.gain.gain);
        currentSound.osc.connect(currentSound.gain);
        currentSound.gain.connect(audioCtx.destination);
        currentSound.osc.start();
        // currentSound.lfo.start();

        currentSound.eg = new EnvGen(audioCtx, currentSound.gain.gain);
        currentSound.eg.mode = 'AD';
        currentSound.eg.attackTime = 0.01;
        currentSound.eg.decayTime = 0.02;
    }
}

let playButton = document.getElementById("play-button");
playButton.onclick = playSound;

const pattern = [30, 32, 34, 35];

const BPM = 480;
const millisecondsPerBeat = 1 / (BPM / (60 * 1000));
let timestampOfLastBeat = null;
let currentBeatIndex = null;
let playing = false;
function stepSound(timestamp) {
    if (currentSound.gain === null) {
        window.requestAnimationFrame(stepSound);
        return;
    }
    if (!playing) {
        timestampOfLastBeat = null;
        currentBeatIndex = null;
        window.requestAnimationFrame(stepSound);
        return;
    }

    if (currentBeatIndex === null) {
        currentBeatIndex = 0;
    }

    if (timestampOfLastBeat === null ||
        timestamp - timestampOfLastBeat >= millisecondsPerBeat) {
        currentSound.osc.frequency.value =
            noteFrequency(pattern[currentBeatIndex]);
        currentSound.eg.gateOn();
        currentBeatIndex = (currentBeatIndex + 1) % pattern.length;
        timestampOfLastBeat = timestamp;
    }

    window.requestAnimationFrame(stepSound);
}

requestAnimationFrame(stepSound);

document.addEventListener('keydown', (event) => {
    if (event.repeat) {
        return;
    }
    switch (event.key) {
    case " ":
        playing = true;
    }
});
document.addEventListener('keyup', (event) => {
    switch (event.key) {
    case " ":
        playing = false;
    }
});
