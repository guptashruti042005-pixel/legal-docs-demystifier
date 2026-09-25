const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { protect } = require('../modules/auth/auth.middleware');
const Document = require('../models/Document');
const Analysis = require('../models/Analysis');

const storageService = require('../services/file/storage.service');
const parserService = require('../services/file/parser.service');
const chunkingService = require('../services/rag/chunking.service');
const embeddingService = require('../services/rag/embedding.service');
const pineconeService = require('../services/rag/pinecone.service');
const retrievalService = require('../services/rag/retrieval.service');
const aiService = require('../services/ai/ai.service');
const logger = require('../config/logger');

const router = express.Router();

// Multer Disk storage configurations (serverless safe)
const { uploadsDir } = require('../config/paths');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 }
});

/**
 * @swagger
 * /api/analyze:
 *   post:
 *     summary: Upload and analyze a legal document
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         description: Document file (PDF, DOCX, TXT, PNG, JPG, JPEG)
 *       - in: formData
 *         name: persona
 *         type: string
 *         enum: [student, business, lawyer, senior, default]
 *         description: Persona target for explanations
 *       - in: formData
 *         name: language
 *         type: string
 *         enum: [en, hi]
 *         description: Output language (en = English, hi = Hindi)
 *     responses:
 *       200:
 *         description: Document analyzed successfully
 */
router.post('/', protect, upload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Define new Document instance first to get Mongoose ID
  let documentRecord = null;

  try {
    // 1. Validate file
    parserService.validateFile(req.file);

    const persona = req.body.persona || 'default';
    const language = req.body.language || 'en';
    const jobDescription = req.body.jobDescription || '';
    const documentType = req.body.documentType || 'general';

    logger.info(`Starting upload process for file: ${req.file.originalname} by User: ${req.user.id}`);

    // 2. Upload file through storage service
    const storageResult = await storageService.uploadFile(req.file);

    // 3. Create document record in MongoDB (processing status)
    documentRecord = await Document.create({
      userId: req.user.id,
      fileName: storageResult.fileName,
      fileSize: storageResult.fileSize,
      filePath: storageResult.filePath,
      documentType,
      status: 'processing'
    });

    // 4. Extract Text content (with OCR fallback)
    const text = await parserService.extractText(storageResult.filePath, storageResult.fileName);
    
    if (!text || text.trim().length < 20) {
      throw new Error('Extracted text is empty or invalid.');
    }

    // 5. Chunk text
    const chunks = chunkingService.chunkText(text);
    logger.info(`Split document into ${chunks.length} chunks.`);

    // 6. Generate Embeddings for chunks
    const embeddingVectors = [];
    for (const chunk of chunks) {
      const vector = await embeddingService.generateEmbedding(chunk.text);
      embeddingVectors.push(vector);
    }

    // 7. Store embeddings in Pinecone
    await pineconeService.upsertVectors(documentRecord._id, chunks, embeddingVectors);
    logger.info(`Upserted vectors to Pinecone for Doc: ${documentRecord._id}`);

    // 8. Prepare context for AI Analysis
    const isResume = documentType === 'resume'
      || storageResult.fileName.toLowerCase().includes('resume')
      || storageResult.fileName.toLowerCase().includes('cv')
      || (jobDescription && jobDescription.trim().length > 0);

    // Provide the full extracted document text to ensure complete clause, financial, risk, and section visibility
    const analysisContext = text;

    // 9. AI Analysis
    let analysisResult = await aiService.analyzeDocument(analysisContext, persona, req.file.originalname, jobDescription, isResume ? 'resume' : documentType);

    // Support translation if Hindi is requested
    if (language === 'hi') {
      logger.info('Translating analysis to Hindi...');
      analysisResult = await aiService.translateAnalysis(analysisResult, 'hi');
    }

    // 10. Save Analysis result
    const rawRisk = (analysisResult.riskLevel || 'low').toLowerCase().trim();
    const riskLevel = ['low', 'medium', 'high'].includes(rawRisk) ? rawRisk : 'low';

    const analysisRecord = await Analysis.create({
      documentId: documentRecord._id,
      userId: req.user.id,
      persona,
      language,
      confidenceScore: analysisResult.confidenceScore || 0.9,
      riskLevel,
      analysis: analysisResult
    });

    // 11. Update document status to ready
    if (documentType === 'resume' || (analysisResult.documentType || '').toLowerCase().includes('resume')) {
      documentRecord.documentType = 'Resume / CV';
    } else {
      documentRecord.documentType = analysisResult.documentType || documentType || 'General Legal Document';
    }
    documentRecord.status = 'ready';
    documentRecord.extractedText = text;
    await documentRecord.save();

    logger.info(`Successfully completed document analysis for Doc ID: ${documentRecord._id}`);

    res.json({
      success: true,
      document: documentRecord,
      analysis: analysisRecord
    });

  } catch (err) {
    logger.error(`Error in analysis route: ${err.message}`);
    
    if (documentRecord) {
      documentRecord.status = 'failed';
      await documentRecord.save();
    }

    // Attempt clean up of local disk files
    if (filePath) {
      await storageService.deleteFile(filePath);
    }

    res.status(500).json({ error: err.message || 'Analysis pipeline failure' });
  }
});

/**
 * @swagger
 * /api/analyze/history:
 *   get:
 *     summary: Retrieve history of user analyses
 *     security:
 *       - bearerAuth: []
 */
router.get('/history', protect, async (req, res) => {
  try {
    const documents = await Document.find({ userId: req.user.id }).sort({ createdAt: -1 });
    
    const analyses = await Analysis.find({ userId: req.user.id })
      .populate('documentId', 'fileName fileSize documentType status uploadDate')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      documents,
      analyses
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/analyze/:id:
 *   get:
 *     summary: Fetch analysis detail
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const analysis = await Analysis.findById(req.params.id)
      .populate('documentId', 'fileName fileSize documentType status uploadDate');
      
    if (!analysis || analysis.userId.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json({
      success: true,
      analysis
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/analyze/document/:id:
 *   delete:
 *     summary: Delete document and its analyses/vectors
 *     security:
 *       - bearerAuth: []
 */
router.delete('/document/:id', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document || document.userId.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // 1. Delete vector embeddings
    await pineconeService.deleteVectors(document._id);

    // 2. Delete file from storage
    await storageService.deleteFile(document.filePath);

    // 3. Delete analysis records
    await Analysis.deleteMany({ documentId: document._id });

    // 4. Delete document record
    await Document.findByIdAndDelete(document._id);

    res.json({ success: true, message: 'Document and analysis details removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
