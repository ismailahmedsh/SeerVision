const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'VisLangStream API Server' });
});

module.exports = router;