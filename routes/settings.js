const express = require('express');
const router = express.Router();

// GET /api/settings
router.get('/', (req, res) => {
  res.json({ message: 'Settings endpoint' });
});

module.exports = router;