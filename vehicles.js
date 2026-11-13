'use strict';
/* Vehicle definitions. Physics: w/h chassis size, wheelR/X/Y wheel radius & mounting, density, accel/maxAV drive,
   air (air control), fuel, stiff/damp (suspension), grip (tires). stats (1-5) are only for the garage display. */
const VEHICLES = [
  { id: 'truck', name: 'Monster Truck', price: 0, kind: 'truck', color: '#2F6F8F', dark: '#245870', w: 150, h: 40, wheelR: 32, wheelX: 58, wheelY: 26,
    density: 0.003, wheelDensity: 0.003, accel: 0.012, maxAV: 0.45, reverseAV: 0.18, air: 0.0045, fuel: 100, stiff: 0.3, damp: 0.14, grip: 1.5,
    cab: { x: -25, w: 70, h: 38 }, stats: { Speed: 3, Power: 5, Weight: 5, Fuel: 4, Grip: 5, Suspension: 4, 'Air control': 2 } },
  { id: 'jeep', name: 'Jeep', price: 200, kind: 'truck', color: '#6B8E3A', dark: '#4F6A2A', w: 130, h: 36, wheelR: 26, wheelX: 48, wheelY: 22,
    density: 0.0028, wheelDensity: 0.0028, accel: 0.013, maxAV: 0.62, reverseAV: 0.2, air: 0.005, fuel: 90, stiff: 0.35, damp: 0.15, grip: 1.4,
    cab: { x: -15, w: 64, h: 34 }, stats: { Speed: 4, Power: 4, Weight: 3, Fuel: 3, Grip: 4, Suspension: 3, 'Air control': 3 } },
  { id: 'bike', name: 'Motocross Bike', price: 350, kind: 'bike', color: '#D9402B', dark: '#7A1F12', w: 86, h: 16, wheelR: 22, wheelX: 40, wheelY: 14,
    density: 0.0025, wheelDensity: 0.0025, accel: 0.016, maxAV: 0.8, reverseAV: 0.25, air: 0.008, fuel: 70, stiff: 0.4, damp: 0.12, grip: 1.3,
    cab: { x: 0, w: 0, h: 0 }, stats: { Speed: 4, Power: 2, Weight: 1, Fuel: 2, Grip: 3, Suspension: 3, 'Air control': 5 } },
  { id: 'sports', name: 'Sports Car', price: 500, kind: 'car', color: '#E8B923', dark: '#A8820F', w: 140, h: 26, wheelR: 22, wheelX: 55, wheelY: 14,
    density: 0.0028, wheelDensity: 0.0028, accel: 0.015, maxAV: 0.85, reverseAV: 0.22, air: 0.0035, fuel: 80, stiff: 0.45, damp: 0.2, grip: 1.1,
    cab: { x: -10, w: 60, h: 24 }, stats: { Speed: 5, Power: 3, Weight: 2, Fuel: 2, Grip: 2, Suspension: 2, 'Air control': 2 } }
];
