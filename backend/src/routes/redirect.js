const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// GET /s/:code
// Redirect short link to destination URL
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // Fetch the link from Firestore
    const docRef = db.collection('short_links').doc(code);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).send('Link not found or expired.');
    }

    const data = docSnap.data();
    const destination = data.destination_url;

    if (!destination) {
      return res.status(404).send('Invalid link data.');
    }

    // Optional: Log analytics (e.g. click count)
    // await docRef.update({ clicks: FieldValue.increment(1) });

    // Perform HTTP 302 Redirect
    res.redirect(302, destination);

  } catch (error) {
    console.error('Error in redirect:', error);
    res.status(500).send('Internal server error.');
  }
});

module.exports = router;
