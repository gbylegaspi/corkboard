// Make the large fixtures once before the run (24 MP photos take a few seconds each to encode).
const f = require('./fixtures');
module.exports = async () => {
  for (let i = 0; i < 5; i++) f.photo24(i);
  for (let i = 0; i < 6; i++) f.photoSmall(i);
  f.sticker(); f.pdf5();
};
