export function normaliseAngle(angle: number): number {
    angle = angle % 360;
    if (angle < 0) {
        angle += 360;
    }
    return angle;
}

export function angleDifference(angle: number, angle2: number): number {
    angle = normaliseAngle(angle)
    angle2 = normaliseAngle(angle2)

    const difference = angle2 - angle
    if (difference > 180) {
        return Math.abs(360 - difference)
    } else {
        return Math.abs(difference)
    }
}

export function roundToTwoDp(n: number): number {
    return Math.round(n*100)/100
}