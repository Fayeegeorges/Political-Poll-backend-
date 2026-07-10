const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const requestIp = require('request-ip');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(requestIp.mw());

// Connect to a local test database
mongoose.connect('mongodb://127.0.0.1:27017/political_poll')
  .then(() => console.log('MongoDB database connected successfully!'))
  .catch(err => console.error('Database connection error:', err));

// Database structural rules (Schema)
const VoteSchema = new mongoose.Schema({
  region: { type: String, required: true },
  representative: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  createdAt: { type: Date, default: Date.now }
});

const VoterIpSchema = new mongoose.Schema({
  ipHash: { type: String, required: true, unique: true },
  votedAt: { type: Date, default: Date.now }
});

const Vote = mongoose.model('Vote', VoteSchema);
const VoterIp = mongoose.model('VoterIp', VoterIpSchema);

// API Endpoint to process an anonymous vote
app.post('/api/vote', async (req, res) => {
  const { region, representative, rating } = req.body;
  
  // Hash the incoming IP network signature to maintain strict user anonymity
  const clientIp = req.clientIp || "127.0.0.1";
  const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex');

  try {
    // Check if this hashed footprint has already submitted a rating entry
    const existingVoter = await VoterIp.findOne({ ipHash });
    if (existingVoter) {
      return res.status(403).json({ error: "Access denied. You have already cast a vote!" });
    }

    // Save the submission details and lock the hashed footprint
    await VoterIp.create({ ipHash });
    await Vote.create({ region, representative, rating });

    res.status(200).json({ success: true, message: "Anonymous rating saved!" });
  } catch (err) {
    res.status(500).json({ error: "Internal database processing error." });
  }
});

// API Endpoint to pull public rolling metrics for Chart.js rendering
app.get('/api/results', async (req, res) => {
  try {
    const results = await Vote.aggregate([
      { $group: { _id: { region: "$region", rep: "$representative", rating: "$rating" }, count: { $sum: 1 } } }
    ]);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch results." });
  }
});

app.listen(3000, () => console.log('Political voting server running live on port 3000!'));