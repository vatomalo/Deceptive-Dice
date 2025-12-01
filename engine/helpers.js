function getHeadPosition(char) {
    if (!char) return { x: 0, y: 0 };

    const anim = char.animations[char.state];
    if (!anim) return { x: char.x, y: char.y - 100 };

    const frameHeight = anim.frameH * char.scale;

    return {
        x: char.x,   // CENTER horizontally
        y: char.y - frameHeight + 10
    };
}
window.getHeadPosition = getHeadPosition;