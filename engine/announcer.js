// =====================================================
// ANNOUNCER SYSTEM
// =====================================================
const Announcer = {
    sounds: {
        fight: new Audio("./SFX/announcer/fight.mp3"),
        KO: new Audio("./SFX/announcer/KO.mp3"),
        gameOver: new Audio("./SFX/announcer/gameover.mp3")
    },

    play(name) {
        const snd = this.sounds[name];
        if (!snd) return;

        snd.volume = 1;
        snd.currentTime = 0;
        snd.play().catch(()=>{});
    }
};

window.Announcer = Announcer;
