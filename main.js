// The maximum is exclusive and the minimum is inclusive
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

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

function makePolySynth(numOscillators, audioCtx) {
    let gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.5;
    gainNode.connect(audioCtx.destination);

    let envelope = new EnvGen(audioCtx, gainNode.gain);
    envelope.mode = 'AD';
    envelope.attackTime = 0.01;
    envelope.decayTime = 0.02;

    let filterNode = audioCtx.createBiquadFilter();
    filterNode.connect(gainNode);

    let oscillators = [];
    for (let i = 0; i < numOscillators; ++i) {
        let osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.connect(filterNode);
        osc.start();
        oscillators.push(osc);
    }

    return {
        gainNode: gainNode,
        envelope: envelope,
        filterNode: filterNode,
        oscillators: oscillators
    };
}

function playNotes(synth, notes) {
    for (let noteIx = 0;
         noteIx < notes.length && noteIx < synth.oscillators.length;
         ++noteIx) {
        synth.oscillators[noteIx].frequency.value =
            noteFrequency(notes[noteIx]);
    }
    synth.envelope.gateOn();
}

let audioCtx = null;
let currentSound = null;
let targetSound = null;

function startSound() {
    if (audioCtx === null) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        currentSound = makePolySynth(/*numOscillators*/1, audioCtx);
         // hopefully disables filter
        currentSound.filterNode.frequency.value = 10000;

        targetSound = makePolySynth(/*numOscillators*/1, audioCtx);
        targetSound.oscillators[0].type = 'sawtooth';
        targetSound.envelope.attackTime = 1.0;
        targetSound.envelope.decayTime = 0.5;
    }
}

function fromBpmToMillisecondsPerBeat(bpm) {
    return 1 / (bpm / (60 * 1000));
}

let playButton = document.getElementById("play-button");
playButton.onclick = startSound;

// Last note of octave is 42
const rootNotes = [30, 32, 34, 35, 37, 39, 41, 42, 44, 46, 47, 49];
const lastIxOfOctave = 7;

let currentBeatIndex = 0;
let targetBeatIndex = null;
let playing = true;
let currentRequested = false;
let targetPattern = null;
let targetPatternIx = null;
const targetPatternBpm = 70;
let timestampOfLastTargetSound = null;
let targetNote = null;
function stepSound(timestamp) {
    if (currentSound === null) {
        window.requestAnimationFrame(stepSound);
        return;
    }
    if (!playing) {
        window.requestAnimationFrame(stepSound);
        return;
    }

    if (currentBeatIndex === null) {
        currentBeatIndex = 0;
    }

    if (currentRequested) {
        playNotes(currentSound, [rootNotes[currentBeatIndex]]);
        currentRequested = false;
    }

    if (targetPattern === null ||
        rootNotes[currentBeatIndex] === targetNote) {
        targetBeatIndex = getRandomInt(0, lastIxOfOctave + 1);
        if (targetBeatIndex === currentBeatIndex) {
            targetBeatIndex = (targetBeatIndex + 1) % (lastIxOfOctave + 1);
        }
        let root = rootNotes[targetBeatIndex];
        let third = rootNotes[targetBeatIndex + 2];
        let fifth = rootNotes[targetBeatIndex + 4];
        targetPattern = [root, fifth];
        targetPatternIx = 0;
        targetNote = third;
    }

    if (timestampOfLastTargetSound === null ||
        timestamp - timestampOfLastTargetSound >=
        fromBpmToMillisecondsPerBeat(targetPatternBpm)) {
        playNotes(targetSound, [targetPattern[targetPatternIx]]);
        targetPatternIx = (targetPatternIx + 1) % targetPattern.length;
        timestampOfLastTargetSound = timestamp;
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
        playing = !playing;
        return;
    case "b":
        currentRequested = true;
        return;
    case "Left":
    case "ArrowLeft":
        if (currentBeatIndex === 0) {
            currentBeatIndex = rootNotes.length - 1;
        } else {
            --currentBeatIndex;
        }
        return;
    case "Right":
    case "ArrowRight":
        currentBeatIndex = (currentBeatIndex + 1) % rootNotes.length;
        return;
    }
});
