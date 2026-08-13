// Égaliseur 10 bandes façon Poweramp (fréquences ISO standard),
// + un Bass Boost dédié (low-shelf séparé des bandes graphiques).

export const EQ_BANDS = [
  { id: "31", label: "31", frequency: 31 },
  { id: "62", label: "62", frequency: 62 },
  { id: "125", label: "125", frequency: 125 },
  { id: "250", label: "250", frequency: 250 },
  { id: "500", label: "500", frequency: 500 },
  { id: "1k", label: "1k", frequency: 1000 },
  { id: "2k", label: "2k", frequency: 2000 },
  { id: "4k", label: "4k", frequency: 4000 },
  { id: "8k", label: "8k", frequency: 8000 },
  { id: "16k", label: "16k", frequency: 16000 },
] as const;

// Un gain par bande, dans le même ordre que EQ_BANDS.
export const EQ_PRESETS: Record<string, number[]> = {
  Plat:     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Basses:   [7, 6, 5, 3, 1, 0, 0, -1, -1, -1],
  Voix:     [-3, -2, -1, 1, 3, 4, 3, 1, 0, -1],
  Aigus:    [-2, -2, -1, -1, 0, 1, 2, 4, 5, 6],
  Puissant: [5, 4, 3, 1, 0, 1, 2, 3, 3, 4], // sonorité "loudness" façon Poweramp
};

// Bass Boost : slider 0-100 (%), mappé sur un filtre low-shelf ~80 Hz.
export const BASS_BOOST_FREQUENCY = 80;
export const BASS_BOOST_MAX_DB = 12;

// Compensation de volume : au-delà d'un certain boost, on regagne du
// niveau perçu pour éviter l'écrêtage (comme le "Loudness" de Poweramp).
export const MAKEUP_GAIN_MAX = 1.6;
