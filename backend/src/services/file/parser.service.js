const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Tesseract = require('tesseract.js');

class ParserService {
  /**
   * Extracts text from any supported file format.
   * Supports: PDF, DOCX, TXT, MD, PNG, JPG, JPEG.
   * @param {string} filePath - Absolute path to file on disk
   * @param {string} originalName - Original name of the uploaded file
   * @returns {Promise<string>} Extracted text content
   */
  async extractText(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase().slice(1);

    if (ext === 'pdf') {
      return await this.extractFromPDF(filePath);
    } else if (ext === 'docx' || ext === 'doc') {
      return await this.extractFromDOCX(filePath);
    } else if (['txt', 'md', 'text'].includes(ext)) {
      return fs.readFileSync(filePath, 'utf-8');
    } else if (['png', 'jpg', 'jpeg', 'bmp', 'tiff'].includes(ext)) {
      return await this.extractFromImageOCR(filePath);
    } else {
      // Fallback: try reading as plain text
      try {
        return fs.readFileSync(filePath, 'utf-8');
      } catch {
        throw new Error(`Unsupported file format: .${ext}. Please upload PDF, DOCX, TXT, or images.`);
      }
    }
  }

  /**
   * Extracts text from PDF files. If scanned (empty text), attempts OCR if page conversion is available,
   * or triggers a helpful exception/fallback text.
   */
  async extractFromPDF(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      if (!data.text || data.text.trim().length === 0) {
        throw new Error('The uploaded PDF appears to be a scanned image or contains no readable text. Please upload a searchable PDF, DOCX, or an image file (PNG/JPG) for OCR processing.');
      }

      return data.text;
    } catch (err) {
      throw new Error(`Failed to extract text from PDF: ${err.message}`);
    }
  }

  /**
   * Extracts text from Word documents.
   */
  async extractFromDOCX(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      if (!result.value || result.value.trim().length === 0) {
        throw new Error('DOCX file is empty.');
      }
      return result.value;
    } catch (err) {
      throw new Error(`Failed to extract text from DOCX: ${err.message}`);
    }
  }

  /**
   * Run Tesseract.js OCR directly on image files.
   */
  async extractFromImageOCR(filePath) {
    try {
      console.log(`Running Tesseract.js OCR on ${filePath}...`);
      const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
        logger: m => console.log(`[OCR PROGRESS] ${m.status}: ${(m.progress * 100).toFixed(1)}%`)
      });
      
      if (!text || text.trim().length === 0) {
        throw new Error('OCR completed but failed to extract any text.');
      }
      
      return text;
    } catch (err) {
      throw new Error(`OCR processing failed: ${err.message}`);
    }
  }

  /**
   * Standard file validation
   */
  validateFile(file) {
    const maxSize = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
    const allowedExts = ['pdf', 'docx', 'doc', 'txt', 'md', 'png', 'jpg', 'jpeg'];
    
    if (file.size > maxSize) {
      throw new Error(`File is too large. Max allowed size: ${process.env.MAX_FILE_SIZE_MB || 10}MB`);
    }

    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (!allowedExts.includes(ext)) {
      throw new Error(`Unsupported file type: .${ext}. Use: ${allowedExts.join(', ')}`);
    }
  }
}

module.exports = new ParserService();
