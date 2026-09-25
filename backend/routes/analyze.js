const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { extractText, cleanupFile, validateFile } = require('../services/fileParser');
const { analyzeDocument } = require('../services/geminiService');
const { runOfflineAnalysis } = require('../services/analysisEngine');

const router = express.Router();

const { uploadsDir } = require('../src/config/paths');

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 }
});

/**
 * POST /api/analyze
 * Body: multipart/form-data with file + persona
 */
router.post('/', upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Validate file
    validateFile(req.file);

    const persona = req.body.persona || 'default';
    const language = req.body.language || 'en';

    // Extract text from file
    let text;
    try {
      text = await extractText(filePath, req.file.originalname);
    } catch (parseErr) {
      return res.status(422).json({ error: `File parsing failed: ${parseErr.message}`, fallback: true });
    }

    if (!text || text.trim().length < 20) {
      return res.status(422).json({ error: 'Could not extract meaningful text from this file.', fallback: true });
    }

    let analysis;

    // Try Gemini AI first, fall back to offline engine
    if (process.env.GEMINI_API_KEY) {
      try {
        const aiResult = await analyzeDocument(text, persona, req.file.originalname);
        analysis = {
          id: uuidv4(),
          fileName: req.file.originalname,
          fileSize: req.file.size,
          persona,
          uploadDate: new Date().toISOString(),
          source: 'gemini',
          docText: text,
          ...aiResult
        };
      } catch (aiErr) {
        console.warn('Gemini AI failed, falling back to offline analysis:', aiErr.message);
        analysis = runOfflineAnalysis(text, persona, req.file.originalname);
        analysis.fileSize = req.file.size;
        analysis.aiError = 'AI analysis unavailable, showing offline results.';
      }
    } else {
      analysis = runOfflineAnalysis(text, persona, req.file.originalname);
      analysis.fileSize = req.file.size;
    }

    res.json({ success: true, analysis });

  } catch (err) {
    console.error('Analysis route error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  } finally {
    if (filePath) cleanupFile(filePath);
  }
});

/**
 * POST /api/analyze/text
 * Body: { text, persona }
 */
router.post('/text', express.json(), async (req, res) => {
  try {
    const { text, persona = 'default', fileName = 'Pasted_Text.txt' } = req.body;
    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: 'Text is too short to analyze.' });
    }

    let analysis;
    if (process.env.GEMINI_API_KEY) {
      try {
        const aiResult = await analyzeDocument(text, persona, fileName);
        analysis = { id: require('uuid').v4(), fileName, persona, uploadDate: new Date().toISOString(), source: 'gemini', docText: text, ...aiResult };
      } catch (aiErr) {
        analysis = runOfflineAnalysis(text, persona, fileName);
      }
    } else {
      analysis = runOfflineAnalysis(text, persona, fileName);
    }

    res.json({ success: true, analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
