// Generates a readable-but-random password, e.g. "River-Falcon-482"
const WORDS = [
  "River", "Falcon", "Cedar", "Maple", "Harbor", "Summit", "Orbit", "Meadow",
  "Comet", "Granite", "Willow", "Coral", "Ember", "Frost", "Lagoon", "Pebble",
];

function generatePassword() {
  const w1 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const w2 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${w1}-${w2}-${num}`;
}

module.exports = generatePassword;