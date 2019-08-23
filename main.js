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
    envelope.attackTime = 0.03;
    envelope.decayTime = 0.1;

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

function keyOff(synth) {
    synth.envelope.gateOff();
}

let audioCtx = null;
let playerSound = null;
let avoidSound = null;

function startSound() {
    if (audioCtx === null) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        playerSound = makePolySynth(/*numOscillators*/1, audioCtx);
        // hopefully disables filter
        playerSound.filterNode.frequency.value = 10000

        avoidSound = makePolySynth(/*numOscillators*/1, audioCtx);
        avoidSound.oscillators[0].type = 'sawtooth';
        avoidSound.envelope.mode = 'ADSR';
        avoidSound.envelope.attackTime = 0.01;
        avoidSound.envelope.decayTime = 0.02;
        avoidSound.envelope.sustainLevel = 0.5;
        avoidSound.envelope.releaseTime = 0.01;
    }
}

function fromBpmToMillisecondsPerBeat(bpm) {
    return 1 / (bpm / (60 * 1000));
}

let playButton = document.getElementById("play-button");
playButton.onclick = startSound;

// Last note of octave is 42
const fieldNotes = [30, 32, 34, 35, 37, 39, 41, 42, 44, 46, 47, 49];
const lastIxOfOctave = 7;

let playerFieldIndex = 0;
let playing = true;
let playerNoteRequested = false;
let avoidPattern = [[],[6]];
let avoidPatternIx = 0;
const avoidPatternBpm = 60;
let timestampOfLastAvoidSound = null;
let targetNote = 49;
function stepSound(timestamp) {
    if (playerSound === null) {
        window.requestAnimationFrame(stepSound);
        return;
    }
    if (!playing) {
        window.requestAnimationFrame(stepSound);
        return;
    }

    if (playerNoteRequested) {
        playNotes(playerSound, [fieldNotes[playerFieldIndex]]);
        playerNoteRequested = false;
    }

    let newAvoidSoundNeeded = false;
    if (timestampOfLastAvoidSound === null) {
        timestampOfLastAvoidSound = timestamp;
        newAvoidSoundNeeded = true;
    } else if (timestamp - timestampOfLastAvoidSound >=
               fromBpmToMillisecondsPerBeat(avoidPatternBpm)) {
        timestampOfLastAvoidSound = timestamp;
        avoidPatternIx = (avoidPatternIx + 1) % avoidPattern.length;
        newAvoidSoundNeeded = true;
    }

    if (newAvoidSoundNeeded) {
        let fieldNoteIndexes = avoidPattern[avoidPatternIx];
        if (fieldNoteIndexes.length > 0) {
            playNotes(avoidSound,
                      fieldNoteIndexes.map(ix => fieldNotes[ix]));
        } else {
            keyOff(avoidSound);
        }
    }

    if (avoidPatternIx !== null &&
        avoidPattern[avoidPatternIx].includes(playerFieldIndex)) {
        let infoField = document.getElementById("info");
        infoField.innerHTML = "YOU LOST";
        playing = false;
    }

    if (fieldNotes[playerFieldIndex] === targetNote) {
        let infoField = document.getElementById("info");
        infoField.innerHTML = "YOU WON";
        playing = false;
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
        playerNoteRequested = true;
        return;
    case "Left":
    case "ArrowLeft":
        if (playerFieldIndex === 0) {
            playerFieldIndex = fieldNotes.length - 1;
        } else {
            --playerFieldIndex;
        }
        return;
    case "Right":
    case "ArrowRight":
        playerFieldIndex = (playerFieldIndex + 1) % fieldNotes.length;
        return;
    }
});
