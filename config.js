// Game Configuration and Constants
const SHAPES = {
    I: [[1,1,1,1]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1]],
    S: [[0,1,1],[1,1,0]],
    Z: [[1,1,0],[0,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]]
};

const EXTENDED_SHAPES = {
    ...SHAPES,
    I5: [[1,1,1,1,1]],
    Plus: [[0,1,0],[1,1,1],[0,1,0]],
    W: [[1,0,0],[1,1,0],[0,1,1]],
    U: [[1,0,1],[1,1,1]],
    P: [[1,1],[1,1],[1,0]]
};

const COLORS = [
    '#FF6B6B', '#FFA07A', '#F7DC6F', '#52B788',
    '#45B7D1', '#85C1E2', '#BB8FCE'
];

// Game mode configurations
const MODE_CONFIG = {
    drizzle: { cols: 10, hailstorm: false, colorCount: 2 },
    downpour: { cols: 10, hailstorm: false, colorCount: 7 },
    hailstorm: { cols: 10, hailstorm: true, colorCount: 7 },
    blizzard: { cols: 12, hailstorm: false, colorCount: 7 },
    hurricane: { cols: 12, hailstorm: true, colorCount: 7 }
};

const PLANETS = [
    { 
        name: 'Mercury', level: 2, color: '#8C7853', size: 8, distance: 5,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Mercury_in_true_color.jpg',
        gravity: 0.38, tempMin: -173, tempMax: 427, moons: 0,
        dayLength: '59 Earth days', yearLength: '88 Earth days',
        funFact: 'Smallest planet, closest to the Sun'
    },
    { 
        name: 'Venus', level: 3, color: '#FFC649', size: 18, distance: 10,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Venus-real_color.jpg',
        gravity: 0.91, tempMin: 462, tempMax: 462, moons: 0,
        dayLength: '243 Earth days', yearLength: '225 Earth days',
        funFact: 'Hottest planet, spins backwards'
    },
    { 
        name: 'Earth', level: 4, color: '#4169E1', size: 18, distance: 15,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg',
        gravity: 1.0, tempMin: -88, tempMax: 58, moons: 1,
        dayLength: '24 hours', yearLength: '365 days',
        funFact: 'The only known planet with life'
    },
    { 
        name: 'Mars', level: 5, color: '#CD5C5C', size: 12, distance: 20,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/02/OSIRIS_Mars_true_color.jpg',
        gravity: 0.38, tempMin: -153, tempMax: 20, moons: 2,
        dayLength: '24.6 hours', yearLength: '687 Earth days',
        funFact: 'The Red Planet, has water ice'
    },
    { 
        name: 'Asteroid Belt', level: 6, isAsteroidBelt: true,
        funFact: 'Rocky remnants between Mars and Jupiter'
    },
    { 
        name: 'Jupiter', level: 7, color: '#DAA520', size: 35, distance: 25,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/Jupiter_and_its_shrunken_Great_Red_Spot.jpg',
        gravity: 2.53, tempMin: -145, tempMax: -145, moons: 95,
        dayLength: '10 hours', yearLength: '12 Earth years',
        funFact: 'Largest planet, Great Red Spot storm'
    },
    { 
        name: 'Saturn', level: 8, color: '#F4A460', size: 30, distance: 30, hasRings: true,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Saturn_during_Equinox.jpg',
        gravity: 1.07, tempMin: -178, tempMax: -178, moons: 146,
        dayLength: '10.7 hours', yearLength: '29 Earth years',
        funFact: 'Famous rings made of ice and rock'
    },
    { 
        name: 'Uranus', level: 9, color: '#4FD0E0', size: 22, distance: 35,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Uranus2.jpg',
        gravity: 0.89, tempMin: -224, tempMax: -224, moons: 28,
        dayLength: '17 hours', yearLength: '84 Earth years',
        funFact: 'Rotates on its side, blue methane'
    },
    { 
        name: 'Neptune', level: 10, color: '#4169E1', size: 21, distance: 40,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/63/Neptune_-_Voyager_2_%2829347980845%29_flatten_crop.jpg',
        gravity: 1.14, tempMin: -214, tempMax: -214, moons: 16,
        dayLength: '16 hours', yearLength: '165 Earth years',
        funFact: 'Farthest planet, fastest winds'
    },
    { 
        name: 'Pluto', level: 11, color: '#B8947D', size: 6, distance: 45,
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Pluto_in_True_Color_-_High-Res.jpg',
        gravity: 0.06, tempMin: -233, tempMax: -223, moons: 5,
        dayLength: '6.4 Earth days', yearLength: '248 Earth years',
        funFact: 'Dwarf planet with a heart shape'
    }
];
