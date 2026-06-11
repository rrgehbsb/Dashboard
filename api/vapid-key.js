// Returns the VAPID public key to the browser — safe to expose, it's a public key.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
};
