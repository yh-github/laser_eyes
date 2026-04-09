function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
}

// simulate points
let eyes = [0, 10];
let nose = [0, 50];
let chin = [0, 100];

console.log("neutral pitch", getDistance(eyes, nose) / getDistance(nose, chin));

// looking up: nose moves up (closer to eyes), chin moves up
eyes = [0, 20];
nose = [0, 40];
chin = [0, 70];
console.log("looking up pitch", getDistance(eyes, nose) / getDistance(nose, chin));

// looking down: nose moves down (closer to chin), chin moves down
eyes = [0, 0];
nose = [0, 60];
chin = [0, 80];
console.log("looking down pitch", getDistance(eyes, nose) / getDistance(nose, chin));
